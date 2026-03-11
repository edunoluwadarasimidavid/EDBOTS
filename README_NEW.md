# EDBOT AI - Professional Redesign

This is a production-level, modular, and scalable architecture for EDBOT AI, built with Baileys.

## 🚀 Key Features

- **Anti-Ban Architecture:**
  - Human-like response delays (1-4s).
  - Per-user and Global rate limiting.
  - Typing presence simulation.
  - Message length limiting (max 2000 chars).
  - Spam & loop protection.
- **Modular Command System:**
  - Auto-loading commands from `src/commands/`.
  - Support for aliases and category grouping.
  - Command-specific cooldowns.
  - Permission-based execution (Owner, Admin, Group).
- **Scalable Structure:**
  - Separation of concerns: Connection, Handler, Anti-Ban, Utils.
  - Centralized logging with `pino`.
- **Stability:**
  - Global crash protection.
  - Automated reconnection logic.

## 📁 Project Structure

```text
/src
  /core
    bot.js           # Main orchestrator
    connection.js    # Baileys connection manager
    commandHandler.js# Command loader and executor
    antiBan.js       # Protection layer
    rateLimiter.js   # Traffic control
  /commands
    /general         # Standard commands (ping, menu)
    /ai              # AI integration
  /utils
    logger.js        # Structured logging
    parser.js        # WhatsApp message cleaner
    delay.js         # Human-behavior helpers
index.js             # Entry point
```

## 🛠️ How to Run

1. **Install Dependencies:**
   ```bash
   npm install
   ```
   *(Optional but recommended for better logs)*: `npm install pino-pretty`

2. **Configure:**
   Ensure your `config.js` and `.env` are set up correctly.

3. **Start the Bot:**
   ```bash
   npm start
   ```

## ➕ Adding New Commands

Create a new `.js` file in any subdirectory of `src/commands/`:

```javascript
module.exports = {
    name: "mycmd",
    aliases: ["alias1"],
    description: "My new command",
    category: "general",
    cooldown: 5,
    ownerOnly: false,
    
    execute: async (sock, parsed, args) => {
        await sock.sendMessage(parsed.from, { text: "Hello!" });
    }
};
```

The bot will automatically detect and load it on next start!

---
*Redesigned by EDBOT AI Team*
