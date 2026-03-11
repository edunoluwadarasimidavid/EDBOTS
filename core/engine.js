/**
 * @file engine.js
 * @description Main bot engine handling Baileys connection, recursive command loading, and safe execution.
 */

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeInMemoryStore, 
    jidDecode 
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const developer = require("./developer");
const settings = require("../config/settings");

// Ensure integrity check passes immediately
developer.checkIntegrity();

const store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });

// Global command registry
const commands = new Map();
const aliases = new Map();

/**
 * Professional CLI Startup Banner
 */
function showBanner() {
    console.log("\x1b[36m" + "=".repeat(50));
    console.log(`🤖 Bot Name: ${settings.botName}`);
    console.log(`👨‍💻 Developer: ${developer.developer}`);
    console.log(`📧 Email: ${developer.developerEmail}`);
    console.log(`🔗 Repo: ${developer.repository}`);
    console.log(`👤 Owner Number: ${settings.ownerNumber.join(", ")}`);
    console.log("=".repeat(50) + "\x1b[0m");
}

/**
 * Recursive Command Loader
 * Scans commands/ directory and all subdirectories.
 */
function loadCommands(dir = path.join(__dirname, "../commands")) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            loadCommands(filePath); // Recurse into subdirectories
        } else if (file.endsWith(".js")) {
            try {
                const command = require(filePath);
                
                // STRICT VALIDATION
                if (!command.name) {
                    console.warn(`\x1b[33m[WARN] Skipping ${file}: Missing 'name' property.\x1b[0m`);
                    continue;
                }
                if (typeof command.execute !== 'function') {
                    console.warn(`\x1b[33m[WARN] Skipping ${file}: 'execute' is not a function.\x1b[0m`);
                    continue;
                }

                commands.set(command.name.toLowerCase(), command);
                
                if (command.aliases && Array.isArray(command.aliases)) {
                    command.aliases.forEach(alias => aliases.set(alias.toLowerCase(), command.name.toLowerCase()));
                }
            } catch (err) {
                console.error(`\x1b[31m[ERROR] Failed to load command ${file}:\x1b[0m`, err);
            }
        }
    }
}

/**
 * Helper: Extract text content from various message types
 */
function getMessageContent(msg) {
    if (!msg.message) return "";
    
    const type = Object.keys(msg.message)[0];
    const content = msg.message[type];

    if (type === 'conversation') return content;
    if (type === 'extendedTextMessage') return content.text;
    if (type === 'imageMessage' || type === 'videoMessage') return content.caption || "";
    if (type === 'buttonsResponseMessage') return content.selectedButtonId;
    if (type === 'listResponseMessage') return content.singleSelectReply.selectedRowId;
    if (type === 'templateButtonReplyMessage') return content.selectedId;

    return "";
}

async function startBot() {
    console.log(`\x1b[34m[INFO] Loading authentication...\x1b[0m`);
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, `../${settings.sessionName}`));
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: true,
        auth: state,
        browser: ["EDBOTS", "Chrome", "1.0.0"], // Identify as a proper browser
        syncFullHistory: false, // Optimize startup
        generateHighQualityLinkPreview: true
    });

    store.bind(sock.ev);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`\x1b[31m[CONNECTION] Closed. Reconnecting: ${shouldReconnect}\x1b[0m`);
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            showBanner();
            console.log(`\x1b[32m[SUCCESS] ${commands.size} commands loaded. Bot is ready!\x1b[0m`);
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (m) => {
        try {
            if (m.type !== "notify") return;
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const senderJid = msg.key.remoteJid;
            const body = getMessageContent(msg);

            // Ignore empty messages
            if (!body) return;

            // Command Parsing
            if (!body.startsWith(settings.prefix)) return;

            const args = body.slice(settings.prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();

            // Resolve command or alias
            let command = commands.get(commandName);
            if (!command && aliases.has(commandName)) {
                command = commands.get(aliases.get(commandName));
            }

            if (command) {
                try {
                    console.log(`\x1b[36m[EXEC] ${commandName} from ${senderJid.split('@')[0]}\x1b[0m`);
                    await command.execute(sock, msg, args);
                } catch (error) {
                    console.error(`\x1b[31m[ERROR] Command ${commandName} failed:\x1b[0m`, error);
                    await sock.sendMessage(senderJid, { text: "⚠️ An internal error occurred while executing this command." });
                }
            }
        } catch (err) {
            console.error("Critical error in message handler:", err);
        }
    });

    return sock;
}

module.exports = {
    startBot,
    loadCommands
};
