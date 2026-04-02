const crypto = require('crypto');
const { initializePayment, verifyTransaction } = require('../services/paystackService');
const { verifyPaystackSignature } = require('../utils/verifyWebhook');
const { 
  addPremiumUser, 
  getPremiumUser, 
  databases, 
  databaseId, 
  TABLES 
} = require('../database/appwrite');
const { ID, Query } = require('node-appwrite');
const { PUBLIC_SERVER_URL } = require('../config/backendUrl');

const FALLBACK_EMAIL = 'smarttechprogramming@gmail.com';

// ENTERPRISE PLAN CONFIGURATION
const PLAN_CONFIG = {
  free: { 
    limit: 5, 
    period: 'daily', 
    description: 'Basic Access'
  },
  weekly: { 
    limit: 20, 
    period: 'monthly', 
    amount: 500, 
    days: 7,
    description: 'Weekly Starter'
  },
  monthly: { 
    limit: 60, 
    period: 'monthly', 
    amount: 1500, 
    days: 30,
    description: 'Pro Monthly'
  },
  yearly: { 
    limit: 240, 
    period: 'monthly', 
    amount: 15000, 
    days: 365,
    description: 'Elite Yearly'
  }
};

const WEBHOOK_EXPIRY_MS = 5 * 60 * 1000;

/**
 * INTERNAL: Verify Payment Integrity
 */
const verifyPaymentIntegrity = (paystackData, targetUserId) => {
  const { amount, metadata, status } = paystackData;
  const { userId, plan } = metadata || {};

  if (status !== 'success') return { valid: false, reason: 'Transaction status not successful' };
  
  if (userId !== targetUserId) {
    console.error(`[AUDIT][SUSPICIOUS] Ownership Mismatch! Ref owner: ${userId}, Requester: ${targetUserId}`);
    return { valid: false, reason: 'Reference ownership mismatch' };
  }

  const expectedAmount = PLAN_CONFIG[plan]?.amount * 100;
  if (!expectedAmount || amount < expectedAmount) {
    console.error(`[AUDIT][SUSPICIOUS] Amount Underpaid! Expected: ${expectedAmount}, Paid: ${amount}`);
    return { valid: false, reason: 'Payment amount mismatch' };
  }

  return { valid: true, plan, userId, amount: amount / 100 };
};

/**
 * 1. Initialize Payment
 */
const createPayment = async (req, res) => {
  try {
    const { userId, plan, email: rawEmail } = req.body;
    const email = (rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) ? rawEmail : FALLBACK_EMAIL;

    if (!userId || !plan || !PLAN_CONFIG[plan]) {
      return res.status(400).json({ success: false, message: 'Invalid userId or plan' });
    }

    const amount = PLAN_CONFIG[plan].amount * 100;
    const response = await initializePayment(email, amount, { userId, plan });

    if (response && response.status) {
      console.log(`[AUDIT] Link Created | User: ${userId} | Ref: ${response.data.reference}`);
      return res.json({ success: true, link: response.data.authorization_url, reference: response.data.reference });
    }
    throw new Error(response.message || 'Paystack initialization failed');
  } catch (error) {
    console.error(`[AUDIT ERROR] createPayment: ${error.message}`);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

/**
 * 2. Payment Callback Handler (GET)
 */
const handleCallback = async (req, res) => {
  const reference = req.query.reference || req.query.trxref;
  const userIdFromQuery = req.query.userId;

  if (!reference) return res.status(400).send('<h1>Missing Reference</h1>');

  try {
    const verification = await verifyTransaction(reference);
    const integrity = verifyPaymentIntegrity(verification.data, userIdFromQuery || verification.data.metadata?.userId);

    if (!integrity.valid) {
      return res.send(`<h1>Validation Failed: ${integrity.reason}</h1>`);
    }

    const isProcessed = await checkReferenceProcessed(reference);
    if (isProcessed) return res.send('<h1>Success: Premium already active.</h1>');

    await activatePremium(integrity.userId, integrity.plan, reference, integrity.amount);
    
    return res.send(`<h1>✅ Success! Your EDBOT Premium is now active.</h1><p>You can return to WhatsApp.</p>`);
  } catch (error) {
    res.status(500).send('<h1>Server Error</h1>');
  }
};

/**
 * 3. Webhook Handler (POST)
 */
const webhookHandler = async (req, res) => {
  try {
    if (!verifyPaystackSignature(req)) return res.status(401).send('Unauthorized');

    const event = req.body;
    const paidAt = new Date(event.data.paid_at || event.data.created_at).getTime();
    if (Date.now() - paidAt > WEBHOOK_EXPIRY_MS) return res.status(200).send('OK');

    if (event.event === 'charge.success') {
      const { userId, plan } = event.data.metadata;
      const integrity = verifyPaymentIntegrity(event.data, userId);

      if (!integrity.valid) return res.status(200).send('OK'); 

      const isProcessed = await checkReferenceProcessed(event.data.reference);
      if (isProcessed) return res.status(200).send('OK');

      await activatePremium(integrity.userId, integrity.plan, event.data.reference, integrity.amount);
    }

    res.status(200).send('OK');
  } catch (error) {
    res.status(500).send('Internal Error');
  }
};

/**
 * ATOMIC ACTIVATION
 */
async function activatePremium(userId, plan, reference, amount) {
  const days = PLAN_CONFIG[plan].days;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  const expiryISO = expiryDate.toISOString();
  const licenseKey = `EDBOT-${plan.toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  try {
    // Update core subscription with notified: false to trigger bot notification
    const table = TABLES.users;
    const existingUsers = await databases.listDocuments(databaseId, table, [Query.equal('user_id', userId)]);

    const data = {
      user_id: userId,
      whatsapp_number: userId,
      plan: plan,
      expires_at: expiryISO,
      status: "active",
      payment_reference: reference,
      license_key: licenseKey,
      messages_used: 0,
      notified: false, // Critical: Bot will pick this up
      last_reset: new Date().toISOString()
    };

    if (existingUsers.total > 0) {
      await databases.updateDocument(databaseId, table, existingUsers.documents[0].$id, data);
    } else {
      await databases.createDocument(databaseId, table, ID.unique(), data);
    }

    // Log Payment
    await databases.createDocument(databaseId, TABLES.payments, ID.unique(), {
      user_id: userId,
      reference: reference,
      amount: amount,
      plan: plan,
      status: 'paid',
      provider: 'paystack',
      paid_at: new Date().toISOString()
    });

    return { success: true, expiry: expiryISO };
  } catch (error) {
    console.error(`[CRITICAL] Activation failed: ${error.message}`);
    throw error;
  }
}

async function checkReferenceProcessed(reference) {
  const result = await databases.listDocuments(databaseId, TABLES.payments, [Query.equal('reference', reference)]);
  return result.total > 0;
}

/**
 * 4. Premium Status & Usage Check (Used by bot before commands)
 */
const checkPremiumAndUsage = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false });

    let user = await getPremiumUser(userId);
    const now = new Date();
    
    // Tiered Reset Logic
    let planType = 'free';
    if (user) {
      const expiry = new Date(user.expires_at);
      if (expiry > now && user.status === 'active') {
        planType = user.plan;
      } else {
        planType = 'free';
      }
    }

    const config = PLAN_CONFIG[planType];
    let used = user ? (user.messages_used || 0) : 0;
    let lastReset = user ? new Date(user.last_reset || 0) : new Date(0);

    // DAILY/MONTHLY RESET
    let needsReset = false;
    if (config.period === 'daily') {
      needsReset = lastReset.toDateString() !== now.toDateString();
    } else {
      needsReset = lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear();
    }

    if (needsReset) {
      used = 0;
      if (user) {
        await databases.updateDocument(databaseId, TABLES.users, user.$id, {
          messages_used: 0,
          last_reset: now.toISOString()
        });
      }
    }

    const isExhausted = used >= config.limit;
    
    // Handle Notification Flag
    let activationData = null;
    if (user && user.notified === false) {
      activationData = { plan: user.plan, expiresAt: user.expires_at };
      // Mark as notified
      await databases.updateDocument(databaseId, TABLES.users, user.$id, { notified: true });
    }

    // Auto-increment usage (non-blocking if bot calls this on command)
    if (!isExhausted && user && req.query.increment === 'true') {
      databases.updateDocument(databaseId, TABLES.users, user.$id, { messages_used: used + 1 });
    }

    res.json({
      isPremium: planType !== 'free',
      plan: planType,
      limit: config.limit,
      used: used,
      isExhausted: isExhausted,
      activationNotify: activationData,
      expiresAt: user ? user.expires_at : null
    });

  } catch (error) {
    console.error('[STATUS ERROR]', error.message);
    res.status(500).json({ success: false });
  }
};

module.exports = { 
  createPayment, 
  handleCallback, 
  webhookHandler, 
  checkPremiumAndUsage,
  PLAN_CONFIG 
};
