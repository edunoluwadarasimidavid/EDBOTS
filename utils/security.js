const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// --- SECURITY CONFIGURATION ---
const ADMIN_FILE = 'admin.key';
const ADMIN_PASS = '123edbot123';
const CORE_DIR = path.join(__dirname, '../core');
const HASH_FILE = path.join(__dirname, '../.hashes.json');

// Encryption Configuration
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Gets the encryption key from environment variables.
 * @returns {Buffer}
 */
function getSecretKey() {
    const secret = process.env.BOT_SECRET || 'default_secret_key_change_me_12345';
    return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Encrypts data using AES-256-CBC.
 */
function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypts data using AES-256-CBC.
 */
function decrypt(text) {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getSecretKey(), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

/**
 * Checks if admin override is present and valid.
 * @returns {boolean}
 */
function isAdminOverride() {
    const adminPath = path.join(__dirname, '../', ADMIN_FILE);
    if (fs.existsSync(adminPath)) {
        const key = fs.readFileSync(adminPath, 'utf8').trim();
        if (key === ADMIN_PASS) {
            console.log('\x1b[35m[ADMIN OVERRIDE] Security check bypassed by owner.\x1b[0m');
            return true;
        }
    }
    return false;
}

/**
 * Generates SHA-256 hashes for files in a directory.
 */
function generateHashes(dirPath) {
    const hashes = {};
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
        const filePath = path.join(dirPath, file);
        if (fs.statSync(filePath).isFile()) {
            const fileBuffer = fs.readFileSync(filePath);
            const hashSum = crypto.createHash('sha256');
            hashSum.update(fileBuffer);
            hashes[file] = hashSum.digest('hex');
        }
    });

    return hashes;
}

/**
 * Validates integrity of files in core directory.
 * Includes Admin Override check.
 */
function validateIntegrity() {
    // 1. Check for Admin Override First
    if (isAdminOverride()) return;

    // 2. Perform Tamper Validation
    if (!fs.existsSync(HASH_FILE)) {
        console.log('\x1b[33m[SECURITY] First run: Generating integrity hashes...\x1b[0m');
        const hashes = generateHashes(CORE_DIR);
        fs.writeFileSync(HASH_FILE, JSON.stringify(hashes, null, 2));
        return;
    }

    const storedHashes = JSON.parse(fs.readFileSync(HASH_FILE, 'utf8'));
    const currentHashes = generateHashes(CORE_DIR);

    let tampered = false;
    for (const file in currentHashes) {
        if (currentHashes[file] !== storedHashes[file]) {
            console.error(`\x1b[31m[CRITICAL] File tampered: core/${file}\x1b[0m`);
            tampered = true;
        }
    }

    // Check if any files were deleted
    for (const file in storedHashes) {
        if (!currentHashes[file]) {
            console.error(`\x1b[31m[CRITICAL] Missing core file: core/${file}\x1b[0m`);
            tampered = true;
        }
    }

    if (tampered) {
        console.error('\x1b[31m[SECURITY] System integrity compromised! Refusing to run.\x1b[0m');
        process.exit(1);
    }

    console.log('\x1b[32m[SECURITY] Integrity check passed. System secure.\x1b[0m');
}

module.exports = {
    encrypt,
    decrypt,
    validateIntegrity,
    isAdminOverride
};
