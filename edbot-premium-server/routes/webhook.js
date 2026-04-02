const express = require('express');
const router = express.Router();
const handlers = require('../controllers/paymentController');

const { webhookHandler } = handlers;

// Diagnostic logs
console.log(`[ROUTE AUDIT] webhook.js: webhookHandler is ${typeof webhookHandler}`);

if (typeof webhookHandler !== 'function') console.error('❌ ERROR: webhookHandler is NOT a function!');

// Paystack POST Webhook (POST /webhook/paystack)
router.post('/paystack', webhookHandler);

module.exports = router;
