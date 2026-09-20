/**
 * @file updates.js
 * @description Version Display & Update Management Command.
 * 
 * Commands:
 *   .updates              - Show current version and changelog
 *   .updates check        - Check for updates
 *   .updates history      - Show version history
 *   .updates changelog    - Show detailed changelog
 *   .updates download     - Download latest release info
 */

const {
    getCurrentVersion,
    getVersionInfo,
    getAvailableVersions,
    formatChangelog,
    compareVersions
} = require('../../utils/versionManager');

const { getFormattedUptime } = require('../../utils/uptime');
const config = require('../../config');

module.exports = {
    name: 'updates',
    aliases: ['version', 'ver', 'info', 'aboutbot'],
    category: 'system',
    description: 'Show bot version and update information',
    usage: '.updates [check/history/changelog]',
    visibility: 'public',

    async execute(sock, msg, args, extra) {
        try {
            const action = args[0]?.toLowerCase();
            const current = getCurrentVersion();

            switch (action) {
                case 'check': {
                    await extra.reply('🔍 Checking for updates...');
                    const info = await getVersionInfo();
                    
                    if (info.updateAvailable) {
                        const latest = info.latestRelease;
                        const currentVer = current.version;
                        const latestVer = latest.version.replace(/^v/, '');
                        
                        let text = `🔄 *Update Available!*\n\n`;
                        text += `*Current Version:* ${currentVer}\n`;
                        text += `*Latest Version:* ${latestVer}\n`;
                        text += `*Published:* ${new Date(latest.publishedAt).toLocaleDateString()}\n\n`;
                        
                        if (latest.body) {
                            text += `*What's New:*\n`;
                            text += latest.body.substring(0, 500);
                            if (latest.body.length > 500) text += '...';
                        }
                        
                        text += `\n\n> _Type \`.update\` to install the latest version_`;
                        return extra.reply(text);
                    } else {
                        return extra.reply(
                            `✅ *You're up to date!*\n\n` +
                            `*Version:* ${current.version}\n` +
                            `*Status:* Latest release\n` +
                            (current.codename ? `*Codename:* ${current.codename}\n` : '')
                        );
                    }
                }

                case 'history':
                case 'versions': {
                    await extra.reply('📚 Fetching version history...');
                    const versions = await getAvailableVersions();
                    
                    if (versions.length === 0) {
                        return extra.reply('📚 No version history available from GitHub.');
                    }
                    
                    let text = `📚 *Version History*\n\n`;
                    versions.slice(0, 10).forEach((v, i) => {
                        const isCurrent = v.version === current.version;
                        const emoji = isCurrent ? '📍' : i === 0 ? '🆕' : '📌';
                        text += `${emoji} *${v.name}*`;
                        if (isCurrent) text += ' (Current)';
                        text += `\n`;
                        text += `   ${new Date(v.publishedAt).toLocaleDateString()}\n`;
                        text += `   ${v.body.substring(0, 80)}${v.body.length > 80 ? '...' : ''}\n\n`;
                    });
                    
                    return extra.reply(text);
                }

                case 'changelog':
                case 'changes': {
                    if (current.changelog && current.changelog.length > 0) {
                        let text = `📋 *Changelog - v${current.version}*\n\n`;
                        text += formatChangelog(current.changelog);
                        return extra.reply(text);
                    }
                    
                    // Try to get from GitHub
                    await extra.reply('📋 Fetching changelog...');
                    const info = await getVersionInfo();
                    
                    if (info.latestRelease && info.latestRelease.body) {
                        let text = `📋 *Latest Changelog*\n\n`;
                        text += `*Version:* ${info.latestRelease.version}\n`;
                        text += `*Date:* ${new Date(info.latestRelease.publishedAt).toLocaleDateString()}\n\n`;
                        text += info.latestRelease.body;
                        return extra.reply(text);
                    }
                    
                    return extra.reply('📋 No changelog available.');
                }

                case 'download': {
                    const info = await getVersionInfo();
                    if (info.latestRelease) {
                        let text = `📥 *Download Info*\n\n`;
                        text += `*Version:* ${info.latestRelease.version}\n`;
                        text += `*Name:* ${info.latestRelease.name}\n`;
                        text += `*Published:* ${new Date(info.latestRelease.publishedAt).toLocaleDateString()}\n`;
                        if (info.latestRelease.zipballUrl) {
                            text += `*Download:* ${info.latestRelease.zipballUrl}\n`;
                        }
                        return extra.reply(text);
                    }
                    return extra.reply('❌ No release available for download.');
                }

                default: {
                    // Main version display
                    const info = await getVersionInfo();
                    const runtime = getFormattedUptime() || '0h 0m';
                    
                    let text = `╭━━━〔 🤖 *EDBOTS VERSION* 〕━━━╮\n`;
                    text += `┃\n`;
                    text += `┃ 📦 *Version:* ${current.version}\n`;
                    
                    if (current.codename) {
                        text += `┃ 🏷️ *Codename:* ${current.codename}\n`;
                    }
                    
                    text += `┃ 🕐 *Uptime:* ${runtime}\n`;
                    text += `┃ 📅 *Last Updated:* ${current.lastUpdated ? new Date(current.lastUpdated).toLocaleDateString() : 'Initial release'}\n`;
                    
                    if (info.gitInfo.commit !== 'unknown') {
                        text += `┃ 🔗 *Commit:* ${info.gitInfo.commit}\n`;
                    }
                    
                    text += `┃\n`;
                    
                    // Update status
                    if (info.updateAvailable) {
                        text += `┃ 🔄 *Update Available:* ${info.latestRelease.version}\n`;
                        text += `┃    Type \`.updates check\` for details\n`;
                    } else {
                        text += `┃ ✅ *Status:* Up to date\n`;
                    }
                    
                    text += `┃\n`;
                    
                    // Recent changelog
                    if (current.changelog && current.changelog.length > 0) {
                        text += `┃ 📋 *Recent Changes:*\n`;
                        current.changelog.slice(0, 3).forEach(entry => {
                            const emoji = entry.type === 'added' ? '✨' 
                                : entry.type === 'fixed' ? '🔧' 
                                : entry.type === 'changed' ? '🔄' : '📝';
                            text += `┃ ${emoji} ${entry.description.substring(0, 50)}\n`;
                        });
                        if (current.changelog.length > 3) {
                            text += `┃ ... and ${current.changelog.length - 3} more\n`;
                        }
                    }
                    
                    text += `┃\n`;
                    text += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;
                    text += `*Commands:*\n`;
                    text += `• \`.updates check\` - Check for updates\n`;
                    text += `• \`.updates history\` - Version history\n`;
                    text += `• \`.updates changelog\` - Full changelog\n`;
                    
                    await sock.sendMessage(extra.from, {
                        text: text.trim(),
                        contextInfo: {
                            externalAdReply: {
                                title: `EDBOTS v${current.version}`,
                                body: current.codename || 'Advanced WhatsApp Bot',
                                thumbnailUrl: "https://github.com/edunoluwadarasimidavid.png",
                                sourceUrl: config.social?.github || "https://github.com/EDBOTS",
                                mediaType: 1,
                                renderLargerThumbnail: true
                            }
                        }
                    }, { quoted: msg });
                }
            }
        } catch (error) {
            console.error('[UPDATES ERROR]', error);
            await extra.reply('❌ Error checking updates.');
        }
    }
};
