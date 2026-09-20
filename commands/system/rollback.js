/**
 * @file rollback.js
 * @description Version Rollback Command for EDBOTS.
 * 
 * Commands:
 *   .rollback              - Show available versions to rollback
 *   .rollback <version>    - Rollback to specific version
 *   .rollback latest       - Rollback to latest stable release
 *   .rollback confirm      - Confirm rollback after preview
 */

const {
    getCurrentVersion,
    getVersionInfo,
    getAvailableVersions,
    getAvailableTags,
    rollbackToVersion,
    compareVersions
} = require('../../utils/versionManager');

module.exports = {
    name: 'rollback',
    aliases: ['revert', 'downgrade'],
    category: 'owner',
    description: 'Rollback to a previous version',
    usage: '.rollback [version/latest]',
    ownerOnly: true,
    visibility: 'private',

    async execute(sock, msg, args, extra) {
        try {
            const action = args[0]?.toLowerCase();
            const current = getCurrentVersion();

            // No args - show available versions
            if (!action) {
                await extra.reply('🔍 Fetching available versions...');
                
                const versions = await getAvailableVersions();
                const tags = await getAvailableTags();
                
                let text = `🔄 *Available Versions for Rollback*\n\n`;
                text += `*Current:* v${current.version}\n\n`;
                
                if (versions.length > 0) {
                    text += `*GitHub Releases:*\n`;
                    versions.slice(0, 8).forEach((v, i) => {
                        const isCurrent = v.version === current.version;
                        const canRollback = compareVersions(current.version, v.version) > 0;
                        const emoji = isCurrent ? '📍' : canRollback ? '✅' : '⬆️';
                        
                        text += `${emoji} *${v.name}*`;
                        if (isCurrent) text += ' (Current)';
                        text += `\n`;
                        text += `   📅 ${new Date(v.publishedAt).toLocaleDateString()}\n`;
                        text += `   📝 ${v.body.substring(0, 60)}${v.body.length > 60 ? '...' : ''}\n\n`;
                    });
                }
                
                if (tags.length > 0) {
                    text += `*Git Tags:*\n`;
                    tags.slice(0, 5).forEach(tag => {
                        text += `• ${tag}\n`;
                    });
                }
                
                text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                text += `> _Use \`.rollback <version>\` to rollback_\n`;
                text += `> _Example: \`.rollback 1.0.0\`_`;
                
                return extra.reply(text);
            }

            // Confirm rollback
            if (action === 'confirm') {
                const targetVersion = args[1];
                if (!targetVersion) {
                    return extra.reply('❌ Please specify a version: `.rollback confirm <version>`');
                }
                
                await extra.reply(`🔄 Rolling back to v${targetVersion}...\n\n⚠️ Creating backup first...`);
                
                const result = await rollbackToVersion(targetVersion);
                
                if (result.success) {
                    return extra.reply(
                        `✅ *Rollback Successful!*\n\n` +
                        `*From:* v${current.version}\n` +
                        `*To:* v${result.version}\n\n` +
                        `*Note:* Session data was preserved.\n` +
                        `> _Bot will restart to apply changes_`
                    );
                } else {
                    return extra.reply(
                        `❌ *Rollback Failed!*\n\n` +
                        `*Error:* ${result.error}\n\n` +
                        `*Current version:* v${current.version}\n` +
                        `*Target version:* v${targetVersion}\n\n` +
                        `> _Bot is still running on v${current.version}_`
                    );
                }
            }

            // Rollback to latest stable
            if (action === 'latest') {
                const info = await getVersionInfo();
                if (info.latestRelease) {
                    const targetVersion = info.latestRelease.version.replace(/^v/, '');
                    
                    if (compareVersions(current.version, targetVersion) <= 0) {
                        return extra.reply(
                            `✅ *Already up to date!*\n\n` +
                            `*Current:* v${current.version}\n` +
                            `*Latest:* v${targetVersion}\n\n` +
                            `No rollback needed.`
                        );
                    }
                    
                    await extra.reply(
                        `⚠️ *Rollback Confirmation Required*\n\n` +
                        `*Current:* v${current.version}\n` +
                        `*Target:* v${targetVersion}\n` +
                        `*Published:* ${new Date(info.latestRelease.publishedAt).toLocaleDateString()}\n\n` +
                        `To confirm, type: \`.rollback confirm ${targetVersion}\``
                    );
                } else {
                    return extra.reply('❌ Could not fetch latest release.');
                }
            }

            // Rollback to specific version
            const targetVersion = action;
            
            // Validate version format
            if (!/^\d+\.\d+\.\d+/.test(targetVersion)) {
                return extra.reply(
                    `❌ *Invalid version format*\n\n` +
                    `*Usage:* \`.rollback <version>\`\n` +
                    `*Example:* \`.rollback 1.0.0\`\n\n` +
                    `*Available commands:*\n` +
                    `• \`.rollback\` - Show available versions\n` +
                    `• \`.rollback latest\` - Rollback to latest stable\n` +
                    `• \`.rollback confirm <version>\` - Confirm rollback`
                );
            }

            // Compare with current
            if (compareVersions(current.version, targetVersion) === 0) {
                return extra.reply(
                    `✅ *Already on this version!*\n\n` +
                    `*Current:* v${current.version}\n` +
                    `*Target:* v${targetVersion}\n\n` +
                    `No rollback needed.`
                );
            }

            if (compareVersions(current.version, targetVersion) < 0) {
                return extra.reply(
                    `⚠️ *Target is newer than current!*\n\n` +
                    `*Current:* v${current.version}\n` +
                    `*Target:* v${targetVersion}\n\n` +
                    `To upgrade, use: \`.update\``
                );
            }

            // Show preview and ask for confirmation
            const versions = await getAvailableVersions();
            const targetRelease = versions.find(v => v.version === targetVersion);
            
            let text = `⚠️ *Rollback Preview*\n\n`;
            text += `*From:* v${current.version}\n`;
            text += `*To:* v${targetVersion}\n`;
            
            if (targetRelease) {
                text += `*Release Date:* ${new Date(targetRelease.publishedAt).toLocaleDateString()}\n`;
                text += `*Description:* ${targetRelease.body.substring(0, 100)}\n`;
            }
            
            text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            text += `⚠️ *Warning:* This will:\n`;
            text += `• Create a backup of current version\n`;
            text += `• Switch to the older version\n`;
            text += `• Preserve session data\n`;
            text += `• Restart the bot\n\n`;
            text += `> _To confirm, type: \`.rollback confirm ${targetVersion}\`_`;
            
            return extra.reply(text);

        } catch (error) {
            console.error('[ROLLBACK ERROR]', error);
            await extra.reply('❌ Error with rollback system.');
        }
    }
};
