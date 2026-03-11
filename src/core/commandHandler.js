/**
 * Command Handler & Loader
 * Automatically loads commands from the /src/commands directory
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../../config');

class CommandHandler {
    constructor() {
        this.commands = new Map();
        this.aliases = new Map();
        this.cooldowns = new Map();
    }

    /**
     * Loads all commands from the specified directory
     * Supports nested directories
     */
    async loadCommands(dirPath = path.join(__dirname, '../commands')) {
        if (!fs.existsSync(dirPath)) {
            logger.warn(`Commands directory not found: ${dirPath}`);
            return;
        }

        const files = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const file of files) {
            const fullPath = path.join(dirPath, file.name);

            if (file.isDirectory()) {
                await this.loadCommands(fullPath);
            } else if (file.name.endsWith('.js')) {
                try {
                    // Force fresh import
                    delete require.cache[require.resolve(fullPath)];
                    const command = require(fullPath);

                    if (command && command.name && typeof command.execute === 'function') {
                        this.commands.set(command.name.toLowerCase(), command);
                        logger.debug(`Loaded command: ${command.name}`);

                        if (command.aliases && Array.isArray(command.aliases)) {
                            command.aliases.forEach(alias => {
                                this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
                            });
                        }
                    } else {
                        logger.warn(`Invalid command file structure: ${file.name}`);
                    }
                } catch (err) {
                    logger.error(`Error loading command ${file.name}: ${err.message}`);
                }
            }
        }

        logger.info(`Successfully loaded ${this.commands.size} commands with ${this.aliases.size} aliases.`);
    }

    /**
     * Validates and executes a command
     */
    async handleCommand(sock, parsedMsg) {
        const { command, from, sender, isGroup, isOwner, args, msg, text } = parsedMsg;
        
        // Find command or alias
        const cmdName = command.toLowerCase();
        const mainCmdName = this.aliases.get(cmdName) || cmdName;
        const cmd = this.commands.get(mainCmdName);

        if (!cmd) {
            // Optional: Handle invalid command
            return;
        }

        // 1. Permission checks
        if (cmd.ownerOnly && !isOwner) {
            return sock.sendMessage(from, { text: config.messages.ownerOnly }, { quoted: msg });
        }

        if (cmd.groupOnly && !isGroup) {
            return sock.sendMessage(from, { text: config.messages.groupOnly }, { quoted: msg });
        }

        if (cmd.adminOnly && isGroup) {
            const metadata = await sock.groupMetadata(from);
            const isAdmin = metadata.participants.some(p => p.id === sender && p.admin !== null);
            if (!isAdmin && !isOwner) {
                return sock.sendMessage(from, { text: config.messages.adminOnly }, { quoted: msg });
            }
        }

        // 2. Command Cooldown
        const now = Date.now();
        const cooldownKey = `${sender}-${mainCmdName}`;
        const lastUsed = this.cooldowns.get(cooldownKey) || 0;
        const cooldownAmount = (cmd.cooldown || 3) * 1000;

        if (now < lastUsed + cooldownAmount) {
            const timeLeft = Math.ceil((lastUsed + cooldownAmount - now) / 1000);
            return sock.sendMessage(from, { text: `⏳ Cooldown active! Please wait ${timeLeft}s.` }, { quoted: msg });
        }

        this.cooldowns.set(cooldownKey, now);

        // 3. Execution (Compatibility Layer)
        try {
            logger.info(`Executing command: ${mainCmdName} for ${sender}`);
            
            // Create compatibility 'extra' context for old commands
            const extra = {
                from,
                sender,
                isGroup,
                isOwner,
                args,
                text,
                reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
                // Add any other properties the old commands might expect
            };

            await cmd.execute(sock, msg, args, extra);
        } catch (err) {
            logger.error(`Error executing command ${mainCmdName}:`, err);
            await sock.sendMessage(from, { text: `❌ Internal Error: ${err.message}` }, { quoted: msg });
        }
    }
}

module.exports = new CommandHandler();
