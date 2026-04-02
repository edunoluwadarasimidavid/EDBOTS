const express = require('express');
const router = express.Router();
const handlers = require('../controllers/paymentController');

const { checkPremiumAndUsage, getAllPremiumUsers, getAnalytics } = handlers;

// Diagnostic logs
console.log(`[ROUTE AUDIT] premium.js: checkPremiumAndUsage is ${typeof checkPremiumAndUsage}`);
console.log(`[ROUTE AUDIT] premium.js: getAllPremiumUsers is ${typeof getAllPremiumUsers}`);
console.log(`[ROUTE AUDIT] premium.js: getAnalytics is ${typeof getAnalytics}`);

if (typeof checkPremiumAndUsage !== 'function') console.error('❌ ERROR: checkPremiumAndUsage is NOT a function!');
if (typeof getAllPremiumUsers !== 'function') console.error('❌ ERROR: getAllPremiumUsers is NOT a function!');
if (typeof getAnalytics !== 'function') console.error('❌ ERROR: getAnalytics is NOT a function!');

router.get('/status', checkPremiumAndUsage);
router.get('/analytics', getAnalytics);
router.get('/list', getAllPremiumUsers);

module.exports = router;
