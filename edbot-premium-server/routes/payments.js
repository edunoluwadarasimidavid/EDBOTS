const express = require('express');
const router = express.Router();
const handlers = require('../controllers/paymentController');

const { createPayment, handleCallback } = handlers;

// Diagnostic logs
console.log(`[ROUTE AUDIT] payments.js: createPayment is ${typeof createPayment}`);
console.log(`[ROUTE AUDIT] payments.js: handleCallback is ${typeof handleCallback}`);

if (typeof createPayment !== 'function') console.error('❌ ERROR: createPayment is NOT a function!');
if (typeof handleCallback !== 'function') console.error('❌ ERROR: handleCallback is NOT a function!');

// 1. Initialize Payment (POST /payment/create)
router.post('/create', createPayment);

// 2. Paystack Callback (GET /payment/callback)
router.get('/callback', handleCallback);

module.exports = router;
