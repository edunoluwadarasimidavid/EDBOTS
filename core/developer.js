/**
 * @file developer.js
 * @description Hardcoded developer metadata. This file is protected and must not be modified by users.
 * @author Edun Oluwadarasimi David
 */

const developerInfo = {
    developer: "Edun Oluwadarasimi David",
    developerEmail: "davidedun2010@gmail.com",
    repository: "https://github.com/edunoluwadarasimidavid/EDBOTS.git"
};

// Freeze the object to prevent runtime modification
Object.freeze(developerInfo);

/**
 * Runtime integrity check to ensure the developer name has not been tampered with.
 * If modified, the bot will immediately stop execution.
 */
function checkIntegrity() {
    if (developerInfo.developer !== "Edun Oluwadarasimi David") {
        console.error("\x1b[31m[CRITICAL ERROR] Integrity check failed: Developer metadata has been tampered with!\x1b[0m");
        process.exit(1);
    }
}

module.exports = {
    ...developerInfo,
    checkIntegrity
};
