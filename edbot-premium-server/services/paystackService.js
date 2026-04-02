const axios = require('axios');
require('dotenv').config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const paystack = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Initialize a transaction
 * @param {string} email 
 * @param {number} amount In Kobo (100 kobo = 1 Naira)
 * @param {object} metadata 
 */
const initializePayment = async (email, amount, metadata) => {
  try {
    const response = await paystack.post('/transaction/initialize', {
      email,
      amount,
      metadata
    });
    return response.data;
  } catch (error) {
    console.error('Paystack Initialize Error:', error.response ? error.response.data : error.message);
    throw error;
  }
};

/**
 * Verify a transaction by reference
 * @param {string} reference 
 */
const verifyTransaction = async (reference) => {
  try {
    const response = await paystack.get(`/transaction/verify/${reference}`);
    return response.data;
  } catch (error) {
    console.error('Paystack Verify Error:', error.response ? error.response.data : error.message);
    throw error;
  }
};

module.exports = {
  initializePayment,
  verifyTransaction
};