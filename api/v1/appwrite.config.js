/**
 * @file api/v1/appwrite.config.js
 * @description Single source of truth for Appwrite constants (hardcoded per
 * project decision — these are resource identifiers, NOT secrets).
 *
 * API keys / secrets, if ever needed, must come from environment variables
 * (e.g. EDBOTS_APPWRITE_API_KEY) — never hardcoded here.
 */

module.exports = {
  endpoint: 'https://fra.cloud.appwrite.io/v1',
  projectId: 'edsystem',
  databaseId: '6ab8072800398585083e',
  usersCollectionId: '6ab808260033c1647333',

  // Field in the users collection that holds the Appwrite account's $id.
  // Verified against edbot-premium-server paymentController.js
  // (Query.equal('user_id', userId)).
  membershipUserIdField: 'user_id',

  /**
   * Membership decision from the users collection:
   * - docs.length >= 1  → premium (a row means a paid membership record)
   * - docs.length === 0  → free
   * A lookup failure is auth infrastructure trouble (503), not "free".
   */
  isPremiumFn: (docs) => Array.isArray(docs) && docs.length > 0,

  // Abort an Appwrite HTTP call after this long. The caller converts a
  // timeout into SERVICE_UNAVAILABLE (→ v1 INTERNAL_ERROR family), never a
  // silent auth pass-through.
  timeoutMs: parseInt(process.env.EDBOTS_APPWRITE_TIMEOUT_MS || '8000', 10)
};
