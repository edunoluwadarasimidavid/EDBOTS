/**
 * Formats process uptime into "Xh Xm"
 */
function getFormattedUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

module.exports = { getFormattedUptime };
