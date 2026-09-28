/**
 * @file stats.js
 * @description Public bot statistics — works for EVERYONE in private chat
 * and groups. This command owns the `.stats` alias; group-specific stats
 * live at `.gstats` (per-group activity) and `.insights` (admin analytics).
 */

const { getFormattedUptime } = require('../../utils/uptime');
const config = require('../../config');

module.exports = {
    name: 'botstats',
    aliases: ['stats', 'stat'],
    category: 'general',
    description: "Show the bot's live statistics (public)",
    usage: '.stats',
    visibility: 'public',

    async handler(context) {
        const { sock, msg, commands, reply } = context;

        try {
            const memory = process.memoryUsage();
            const ramMb = (memory.rss / 1024 / 1024).toFixed(1);
            const heapMb = (memory.heapUsed / 1024 / 1024).toFixed(1);

            let commandCount = 0;
            if (commands && typeof commands.size === 'number') {
                // Count unique commands (aliases point at the same object)
                const unique = new Set();
                for (const cmd of commands.values()) unique.add(cmd.name);
                commandCount = unique.size;
            }

            const botNumber = sock?.user?.id ? sock.user.id.split(':')[0] : 'Unknown';
            const pushName = msg.pushName || 'Friend';
            const mode = config.selfMode ? 'Private 🔒' : 'Public 🌐';

            await reply(
                `📊 *EDBOTS — Live Stats*\n\n` +
                `🤖 *Status:* Online ✅\n` +
                `⏱️ *Uptime:* ${getFormattedUptime()}\n` +
                `🧠 *RAM:* ${ramMb} MB (heap ${heapMb} MB)\n` +
                `📦 *Commands:* ${commandCount} loaded\n` +
                `🌐 *Mode:* ${mode}\n` +
                `📱 *Bot number:* +${botNumber}\n\n` +
                `👋 Hello *${pushName}*, the bot is alive and serving everyone!\n` +
                `Try *.menu* to see what I can do.`
            );
        } catch (error) {
            console.error('[STATS] Error:', error);
            await reply('❌ Could not fetch stats right now.');
        }
    }
};
