/**
 * Environment Variable Validator
 * Ensures all required keys for AppWrite and Paystack are present.
 */

const requiredEnv = [
  'PAYSTACK_SECRET_KEY',
  'PAYSTACK_WEBHOOK_SECRET',
  'APPWRITE_ENDPOINT',
  'APPWRITE_PROJECT_ID',
  'APPWRITE_API_KEY',
  'APPWRITE_DATABASE_ID',
  'APPWRITE_COLLECTION_ID'
];

const validateEnv = () => {
  const missing = [];
  
  requiredEnv.forEach(key => {
    if (!process.env[key] || process.env[key].trim() === '') {
      missing.push(key);
    }
  });

  if (missing.length > 0) {
    console.error(`
❌ [CRITICAL] MISSING ENVIRONMENT VARIABLES:`);
    missing.forEach(key => console.error(`   - ${key}`));
    console.error(`
Please check your .env file and try again.
`);
    return false;
  }

  // AppWrite UID Length Validation (Collection ID / Database ID)
  // AppWrite UIDs must be <= 36 chars
  const uidsToCheck = {
    'APPWRITE_PROJECT_ID': process.env.APPWRITE_PROJECT_ID,
    'APPWRITE_DATABASE_ID': process.env.APPWRITE_DATABASE_ID,
    'APPWRITE_COLLECTION_ID': process.env.APPWRITE_COLLECTION_ID
  };

  for (const [key, value] of Object.entries(uidsToCheck)) {
    if (value && value.length > 36) {
      console.error(`
❌ [ERROR] ${key} is invalid!`);
      console.error(`   Value: "${value}"`);
      console.error(`   Reason: UID must contain at most 36 chars (Current: ${value.length})
`);
      return false;
    }
  }

  return true;
};

module.exports = validateEnv;
