#!/usr/bin/env node
/**
 * @file api/createKey.js
 * @description CLI helper to create per-user API keys.
 *
 * Usage:
 *   node api/createKey.js <owner> [scopes]
 *   node api/createKey.js "2348012345678" read,write
 *
 * - owner: identity that the key controls (a WhatsApp number or any label)
 * - scopes: comma-separated. Default: read,write. Add "admin" for full access.
 *
 * The plaintext key is printed ONCE and never stored — only its SHA-256 hash
 * is written to data/apiKeys.json (gitignored).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const KEYS_FILE = path.join(ROOT_DIR, 'data', 'apiKeys.json');

function main() {
  const [owner, scopesArg] = process.argv.slice(2);

  if (!owner) {
    console.error('Usage: node api/createKey.js <owner> [scopes]');
    console.error('Example: node api/createKey.js "2348012345678" read,write');
    process.exit(1);
  }

  const scopes = (scopesArg || 'read,write')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (scopes.some((s) => !['read', 'write', 'admin'].includes(s))) {
    console.error('Invalid scope. Allowed: read, write, admin');
    process.exit(1);
  }

  const key = `edb_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');

  fs.mkdirSync(path.dirname(KEYS_FILE), { recursive: true });

  let store = { keys: [] };
  try {
    if (fs.existsSync(KEYS_FILE)) {
      store = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
      if (!Array.isArray(store.keys)) store.keys = [];
    }
  } catch {
    store = { keys: [] };
  }

  const entry = {
    keyId: `key_${crypto.randomBytes(4).toString('hex')}`,
    owner: owner.trim(),
    keyHash,
    scopes,
    revoked: false,
    createdAt: new Date().toISOString()
  };

  store.keys.push(entry);
  fs.writeFileSync(KEYS_FILE, JSON.stringify(store, null, 2));

  console.log('API key created.');
  console.log(`  keyId : ${entry.keyId}`);
  console.log(`  owner : ${entry.owner}`);
  console.log(`  scopes: ${entry.scopes.join(',')}`);
  console.log('');
  console.log('COPY THIS KEY NOW — it is NOT stored anywhere:');
  console.log('');
  console.log(`  ${key}`);
  console.log('');
  console.log('Use it as:  X-API-Key: <key>   or   Authorization: Bearer <key>');
}

main();
