const crypto = require('crypto');
require('dotenv').config();

/**
 * Verify Paystack webhook signature
 * @param {object} req Express request object
 * @returns {boolean}
 */
const verifyPaystackSignature = (req) => {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
  const hash = crypto
    .createHmac('sha512', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  return hash === req.headers['x-paystack-signature'];
};

module.exports = {
  verifyPaystackSignature
};