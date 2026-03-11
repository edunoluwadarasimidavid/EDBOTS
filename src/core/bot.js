/**
 * Bot Orchestrator
 * Integrates connection, parsing, anti-ban, and command handling
 */

const connectionManager = require('./connection');
const { parseMessage } = require('../utils/parser');
const antiBan = require('./antiBan');
const commandHandler = require('./commandHandler');
const logger = require('../utils/logger');
const config = require('../../config');

const path = require('path');

class Bot {
    constructor() {
        this.sock = null;
    }

    async start() {
        try {
            // 1. Load commands (New & Old)
            await commandHandler.loadCommands(path.join(__dirname, '../commands')); // New
            await commandHandler.loadCommands(path.join(__dirname, '../../commands')); // Old

            // 2. Connect to WhatsApp
            this.sock = await connectionManager.connect();

            // 3. Register events
            this.registerEvents();

            logger.info('Bot is initializing standard events...');
        } catch (err) {
            logger.error('Failed to start bot:', err);
            process.exit(1);
        }
    }

    registerEvents() {
        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                logger.info('✅ WhatsApp Connection Established!');
            } else if (connection === 'close') {
                connectionManager.handleDisconnection(lastDisconnect, () => this.start());
            }
        });

        this.sock.ev.on('messages.upsert', async (m) => {
            if (m.type !== 'notify') return;

            for (const msg of m.messages) {
                try {
                    // Ignore status updates
                    if (msg.key.remoteJid === 'status@broadcast') continue;

                    // 1. Parse Message
                    const parsed = await parseMessage(this.sock, msg);
                    if (!parsed || !parsed.body) continue;

                    // 2. Anti-Ban Filter
                    const shouldRespond = await antiBan.shouldRespond(parsed);
                    if (!shouldRespond) continue;

                    // 3. Command Handling
                    if (parsed.isCmd) {
                        // Human-like response delay for commands
                        await antiBan.simulateHumanBehavior(this.sock, parsed.from);
                        await commandHandler.handleCommand(this.sock, parsed);
                    } else {
                        // Handle normal messages (AI, Auto-reply, etc.)
                        await this.handleNormalMessage(parsed);
                    }
                } catch (err) {
                    logger.error('Error processing message upsert:', err);
                }
            }
        });

        // Anti-Call Listener
        this.sock.ev.on('call', async (calls) => {
            if (config.defaultGroupSettings && config.defaultGroupSettings.anticall) {
                for (const call of calls) {
                    if (call.status === 'offer') {
                        logger.info(`Blocking incoming call from ${call.from}`);
                        await this.sock.sendMessage(call.from, { text: "📵 *EDBOT AI: Anti-Call active!* Calls are not allowed." });
                        await this.sock.updateBlockStatus(call.from, 'block');
                    }
                }
            }
        });
    }

    async handleNormalMessage(parsed) {
        // AI Auto Reply Logic from old handler
        if (config.autoReply && !parsed.isBot && !parsed.isCmd) {
            const { askAI } = require('../../utils/aiEngine'); // Corrected path
            const answer = await askAI(parsed.body);
            if (answer && answer !== "NOT_CONNECTED") {
                await antiBan.simulateHumanBehavior(this.sock, parsed.from);
                await this.sock.sendMessage(parsed.from, { text: answer }, { quoted: parsed.msg });
            }
        }
    }
}

module.exports = new Bot();
