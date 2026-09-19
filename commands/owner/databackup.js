/**
 * Data Backup Command - Backup and restore bot data
 * Owner-only restricted command
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const BACKUP_DIR = path.join(__dirname, '../../data/backups');

module.exports = {
    name: 'backup',
    aliases: ['databackup', 'save', 'export'],
    category: 'owner',
    description: 'Backup and restore bot data',
    usage: '.backup <action>',
    ownerOnly: true,

    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                return extra.reply(
                    `💾 *Data Backup System*\n\n` +
                    `*Actions:*\n` +
                    `• \`.backup create\` - Create a backup\n` +
                    `• \`.backup list\` - List existing backups\n` +
                    `• \`.backup info\` - Show data size info\n` +
                    `• \`.backup cleanup\` - Remove old backups\n\n` +
                    `*Backed up data:*\n` +
                    `• Database (groups, users, warnings)\n` +
                    `• Auto-replies & catalogs\n` +
                    `• Bot configuration`
                );
            }

            const action = args[0].toLowerCase();

            switch (action) {
                case 'create':
                case 'backup': {
                    await extra.reply('⏳ Creating backup...');

                    if (!fs.existsSync(BACKUP_DIR)) {
                        fs.mkdirSync(BACKUP_DIR, { recursive: true });
                    }

                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const zipPath = path.join(BACKUP_DIR, `backup_${timestamp}.zip`);
                    const zip = new AdmZip();

                    // Files to backup
                    const backupFiles = [
                        'database/groups.json',
                        'database/users.json',
                        'database/warnings.json',
                        'database/mods.json',
                        'database/banned.json',
                        'database/roles.json',
                        'database/securitylog.json',
                        'data/autoReplies.json',
                        'data/catalog.json',
                        'data/botModes.json',
                        'data/reminders.json',
                        'data/polls.json'
                    ];

                    let backedUp = 0;
                    for (const file of backupFiles) {
                        const fullPath = path.join(__dirname, '../..', file);
                        if (fs.existsSync(fullPath)) {
                            const content = fs.readFileSync(fullPath, 'utf8');
                            zip.addFile(file, Buffer.from(content, 'utf8'));
                            backedUp++;
                        }
                    }

                    zip.writeZip(zipPath);
                    const stats = fs.statSync(zipPath);

                    return extra.reply(
                        `✅ *Backup Created!*\n\n` +
                        `📦 File: backup_${timestamp}.zip\n` +
                        `📊 Files backed up: ${backedUp}\n` +
                        `💾 Size: ${(stats.size / 1024).toFixed(2)} KB\n` +
                        `🕐 Time: ${new Date().toLocaleString()}`
                    );
                }

                case 'list':
                case 'ls': {
                    if (!fs.existsSync(BACKUP_DIR)) {
                        return extra.reply('📭 No backups found.');
                    }

                    const files = fs.readdirSync(BACKUP_DIR)
                        .filter(f => f.endsWith('.zip'))
                        .sort()
                        .reverse()
                        .slice(0, 10);

                    if (files.length === 0) {
                        return extra.reply('📭 No backups found.');
                    }

                    let text = `💾 *Recent Backups (${files.length}):*\n\n`;
                    files.forEach((f, i) => {
                        const stats = fs.statSync(path.join(BACKUP_DIR, f));
                        text += `${i + 1}. ${f}\n   Size: ${(stats.size / 1024).toFixed(2)} KB | ${stats.mtime.toLocaleDateString()}\n`;
                    });

                    return extra.reply(text);
                }

                case 'info': {
                    const dataDir = path.join(__dirname, '../../database');
                    const dataSize = fs.existsSync(dataDir)
                        ? fs.readdirSync(dataDir).reduce((sum, f) => {
                            const stats = fs.statSync(path.join(dataDir, f));
                            return sum + stats.size;
                        }, 0)
                        : 0;

                    const backupCount = fs.existsSync(BACKUP_DIR)
                        ? fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.zip')).length
                        : 0;

                    return extra.reply(
                        `📊 *Data Info*\n\n` +
                        `📁 Database size: ${(dataSize / 1024).toFixed(2)} KB\n` +
                        `💾 Total backups: ${backupCount}\n` +
                        `🕐 Last checked: ${new Date().toLocaleString()}`
                    );
                }

                case 'cleanup': {
                    if (!fs.existsSync(BACKUP_DIR)) {
                        return extra.reply('📭 No backups to clean.');
                    }

                    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.zip'));
                    // Keep only the 5 most recent
                    const sorted = files.sort().reverse();
                    let deleted = 0;

                    for (let i = 5; i < sorted.length; i++) {
                        fs.unlinkSync(path.join(BACKUP_DIR, sorted[i]));
                        deleted++;
                    }

                    return extra.reply(`🧹 Cleaned up ${deleted} old backups. Kept 5 most recent.`);
                }

                default:
                    return extra.reply('❌ Use `create`, `list`, `info`, or `cleanup`.');
            }

        } catch (error) {
            console.error('[BACKUP ERROR]', error);
            await extra.reply('❌ Error with backup system.');
        }
    }
};
