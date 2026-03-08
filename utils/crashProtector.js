/**
 * Crash Protector & Process Monitor
 * Prevents the bot from dying on unhandled errors and ensures graceful exits.
 */

function initializeCrashProtection() {
    process.on('uncaughtException', (err) => {
        console.error(' [CRITICAL ERROR] Uncaught Exception:', err);
        // We don't exit here to keep the bot alive, but we log the full trace
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error(' [WARNING] Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('SIGINT', () => {
        console.log(' [SYSTEM] SIGINT received. Cleaning up and exiting...');
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log(' [SYSTEM] SIGTERM received. Graceful shutdown...');
        process.exit(0);
    });

    console.log(' ✅ [System] Crash protection active.');
}

module.exports = { initializeCrashProtection };
