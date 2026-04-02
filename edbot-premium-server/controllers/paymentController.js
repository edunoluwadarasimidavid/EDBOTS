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
const PLANS = {
  weekly: { amount: 500, days: 7 },
  monthly: { amount: 1500, days: 30 },
  yearly: { amount: 15000, days: 365 }
};

// Official Paystack IP Whitelist
const PAYSTACK_IPS = ['52.31.139.75', '52.49.173.169', '52.214.14.220'];

/**
 * Helper to validate email
 */
const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
};

/**
 * 1. Initialize Payment
 */
const createPayment = async (req, res) => {
  try {
    const { userId, plan } = req.body;
    let { email } = req.body;

    if (!userId || !plan || !PLANS[plan]) {
      return res.status(400).json({ success: false, message: 'Invalid userId or plan' });
    }

    if (!email || !isValidEmail(email)) {
      email = FALLBACK_EMAIL;
    }

    const amount = PLANS[plan].amount * 100;
    const metadata = { userId, plan };
    
    // Use PUBLIC_SERVER_URL for callback - no .env override allowed
    const callback_url = `${PUBLIC_SERVER_URL}/payment/callback`;

    console.log(`[PAYSTACK INIT] User: ${userId} | Email: ${email} | Plan: ${plan}`);
    console.log(`[PAYSTACK INIT] Callback URL: ${callback_url}`);

    const response = await initializePayment(email, amount, metadata);

    if (response && response.status) {
      console.log(`[PAYSTACK INIT] Success | Ref: ${response.data.reference}`);
      return res.json({ 
        success: true, 
        link: response.data.authorization_url, 
        reference: response.data.reference,
        callback_url: callback_url
      });
    } else {
      console.error(`[PAYSTACK INIT] Failed: ${response.message || 'Unknown Error'}`);
      return res.status(400).json({ success: false, message: 'Failed to initialize payment' });
    }
  } catch (error) {
    console.error(`[PAYSTACK INIT ERROR] ${error.message}`);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

/**
 * 2. Payment Callback Handler (GET)
 */
const handleCallback = async (req, res) => {
  const reference = req.query.reference || req.query.trxref;
  console.log(`[PAYSTACK CALLBACK] Received Ref: ${reference}`);

  if (!reference) {
    return res.status(400).send('<h1>Error: No reference provided</h1>');
  }

  try {
    const verification = await verifyTransaction(reference);

    if (verification && verification.status && verification.data.status === 'success') {
      const { userId, plan } = verification.data.metadata;
      
      const existingUser = await getPremiumUser(userId);
      if (existingUser && existingUser.payment_reference === reference) {
         return res.send('<h1>Success: Premium already activated for this reference.</h1>');
      }

      await activatePremium(userId, plan, reference, verification.data.amount / 100);
      return res.send('<h1>Success! Your EDBOT Premium is now active.</h1>');
    } else {
      console.warn(`[PAYSTACK CALLBACK] Verification failed or pending for ${reference}`);
      return res.send('<h1>Payment Verification Pending...</h1>');
    }
  } catch (error) {
    console.error(`[PAYSTACK CALLBACK ERROR] ${error.message}`);
    res.status(500).send('<h1>Internal Server Error</h1>');
  }
};

/**
 * 3. Webhook Handler (POST)
 */
const webhookHandler = async (req, res) => {
  try {
    // 1. IP Whitelist Check (with Cloudflare support)
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.connection.remoteAddress;
    
    // In production, uncomment the IP check for strict security
    /*
    if (!PAYSTACK_IPS.includes(clientIp)) {
      console.warn(`[PAYSTACK WEBHOOK] Unauthorized IP Attempt: ${clientIp}`);
      return res.status(403).send('Forbidden');
    }
    */

    // 2. Signature Verification
    if (!verifyPaystackSignature(req)) {
      console.warn('[PAYSTACK WEBHOOK] Invalid Signature');
      return res.status(401).send('Invalid signature');
    }

    const event = req.body;
    
    // Store webhook log
    try {
      await databases.createDocument(databaseId, TABLES.webhook, ID.unique(), {
        provider: 'paystack',
        reference: event.data?.reference || 'N/A',
        payload: JSON.stringify(event).slice(0, 65000),
        status: event.event,
        received_at: new Date().toISOString()
      });
    } catch (e) {
      console.error(`[APPWRITE FAILURE] Table: ${TABLES.webhook} | Webhook logging failed: ${e.message}`);
    }

    if (event.event === 'charge.success') {
      const { userId, plan } = event.data.metadata;
      const reference = event.data.reference;

      const existingUser = await getPremiumUser(userId);
      if (existingUser && existingUser.payment_reference === reference) {
        console.log(`[PAYSTACK WEBHOOK] Skipping: ${userId} already active for ${reference}`);
        return res.status(200).send('OK');
      }

      await activatePremium(userId, plan, reference, event.data.amount / 100);
      console.log(`[PAYSTACK WEBHOOK] Premium activated for ${userId}`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error(`[PAYSTACK WEBHOOK ERROR] ${error.message}`);
    res.status(500).send('Internal Error');
  }
};

/**
 * Private: Activate Premium logic
 */
const activatePremium = async (userId, plan, reference, amount) => {
  const days = PLANS[plan].days;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  
  const licenseKey = `EDBOT-${plan.toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  await addPremiumUser(userId, plan, expiryDate.toISOString(), reference, licenseKey);

  try {
    await databases.createDocument(databaseId, TABLES.licenses, ID.unique(), {
      license_key: licenseKey,
      whatsapp_number: userId,
      status: 'active',
      bound_at: new Date().toISOString()
    });
  } catch (e) {
    console.error(`[APPWRITE FAILURE] Table: ${TABLES.licenses} | Error: ${e.message}`);
  }

  try {
    await databases.createDocument(databaseId, TABLES.payments, ID.unique(), {
      user_id: userId,
      reference: reference,
      amount: amount,
      plan: plan,
      status: 'paid',
      provider: 'paystack',
      paid_at: new Date().toISOString()
    });
  } catch (e) {
    console.error(`[APPWRITE FAILURE] Table: ${TABLES.payments} | Error: ${e.message}`);
  }
};

const checkPremiumStatus = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

    const user = await getPremiumUser(userId);
    if (!user) return res.json({ isPremium: false });

    const now = new Date();
    const expiry = new Date(user.expires_at);
    const isActive = expiry > now && user.status === 'active';

    res.json({
      isPremium: isActive,
      plan: user.plan,
      expiresAt: user.expires_at,
      status: user.status
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const getAllPremiumUsers = async (req, res) => {
  const table = TABLES.users;
  try {
    const result = await databases.listDocuments(databaseId, table);
    res.json({ success: true, users: result.documents });
  } catch (error) {
    console.error(`[APPWRITE FAILURE] Table: ${table} | Action: getAllPremiumUsers failed`);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const getAnalytics = async (req, res) => {
  const table = TABLES.analytics;
  try {
    const premiumUsers = await databases.listDocuments(databaseId, TABLES.users);
    let payments = { documents: [], total: 0 };
    try {
      payments = await databases.listDocuments(databaseId, TABLES.payments);
    } catch (e) {}
    
    const now = new Date();
    const activeCount = premiumUsers.documents.filter(u => new Date(u.expires_at) > now).length;
    const totalRevenue = payments.documents.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

    res.json({
      success: true,
      data: {
        total_premium_users: premiumUsers.total,
        active_premium_users: activeCount,
        total_revenue: totalRevenue,
        recent_payments: payments.documents.slice(0, 10)
      }
    });
  } catch (error) {
    console.error(`[APPWRITE FAILURE] Table: ${table} | Action: getAnalytics failed`);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = {
  createPayment,
  handleCallback,
  webhookHandler,
  checkPremiumStatus,
  getAllPremiumUsers,
  getAnalytics
};
