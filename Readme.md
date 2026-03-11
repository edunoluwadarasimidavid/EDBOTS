<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f2027,50:203a43,100:2c5364&height=180&section=header&text=EDBOTS+V2&fontSize=50&fontColor=ffffff&animation=fadeIn&fontAlignY=35"/>

# 🤖 EDBOTS: The Industrial-Grade WhatsApp Framework
### Advanced • Secure • Modular • Terminal-Optimized

<br/>

[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Baileys MD](https://img.shields.io/badge/Baileys-Multi%20Device-00bcd4?style=for-the-badge)](https://github.com/WhiskeySockets/Baileys)
[![Architecture](https://img.shields.io/badge/Architecture-Modular-blueviolet?style=for-the-badge)](https://github.com/edunoluwadarasimidavid/EDBOTS)
[![Security](https://img.shields.io/badge/Security-Anti--Tamper-red?style=for-the-badge)](https://github.com/edunoluwadarasimidavid/EDBOTS)

</div>

---

# 🌍 Overview

**EDBOTS** is a high-performance, terminal-based WhatsApp automation framework built on the **Baileys Multi-Device (MD)** library. Unlike standard bots, EDBOTS is engineered with a **Security-First** approach, featuring a protected core, recursive command loading, and a sandboxed execution environment.

This project is designed for developers who need a stable, scalable, and tamper-proof foundation for WhatsApp automation.

---

# 🛡️ Core Security Features

EDBOTS implements several layers of protection to ensure system integrity and developer attribution:

- **Immutable Developer Metadata:** Core developer information (Name, Email, Repository) is hard-coded and **Object-Frozen**. It cannot be modified at runtime.
- **Runtime Integrity Check:** On startup, the system performs a self-audit. If the developer metadata is missing or altered, the bot immediately terminates execution.
- **Sandboxed Command Execution:** Every command runs inside an isolated `try/catch` block. A failure in one command (e.g., a network error or syntax mistake in a plugin) will **never** crash the entire bot.
- **Pre-Flight Environment Setup:** Automatically detects and creates missing directories (`session`, `commands`, `temp`) to ensure zero-config first runs.
- **Global Process Safety:** Listeners for `uncaughtException` and `unhandledRejection` prevent "silent deaths" and ensure the bot remains online even during unexpected system-level errors.

---

# 🏗️ Modular Architecture

The project follows a clean, decoupled structure for maximum scalability:

```text
edbots/
├── core/
│   ├── developer.js     # [PROTECTED] Hard-coded metadata & integrity logic
│   ├── engine.js        # [ENGINE] Baileys connection & recursive loader
│   └── permissions.js   # [SECURITY] Global owner/admin verification
├── config/
│   └── settings.js      # [CONFIG] User-editable bot & owner settings
├── commands/            # [MODULES] Recursive command directory
│   ├── general/         # Public commands (menu, ping, etc.)
│   ├── admin/           # Group moderation (kick, promote)
│   └── owner/           # System-level commands (restart, update)
├── session/             # [DATA] Multi-file authentication storage
├── temp/                # [DATA] Temporary media buffer
├── index.js             # [ENTRY] Secure system initialization
└── package.json         # [MANIFEST] Dependency management
```

---

# 🚀 Technical Capabilities

### 1. Recursive Command Loading
The engine automatically scans the `commands/` directory and **all its subdirectories**. This allows you to organize hundreds of commands into clean categories without manual imports.

### 2. Advanced Message Parsing
The built-in parser extracts text and commands from:
- Standard text messages
- Image/Video captions
- Quoted messages
- Button responses
- List selections

### 3. Professional CLI Experience
- **Startup Banner:** Displays bot name, developer info, and connection status.
- **Color-Coded Logs:** Real-time terminal logging for execution (`EXEC`), errors (`ERROR`), and connection updates (`CONNECTION`).
- **Memory Management:** Includes commands to monitor RAM usage and system latency.

---

# 🛠️ Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (Version 18.0.0 or higher)
- [Git](https://git-scm.com/)
- A WhatsApp account for linking

### Step-by-Step Installation
1. **Clone the Project:**
   ```bash
   git clone https://github.com/edunoluwadarasimidavid/EDBOTS.git
   cd EDBOTS
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure the Bot:**
   Edit `config/settings.js` to set your owner number and preferred bot name.
   ```bash
   nano config/settings.js
   ```

4. **Launch EDBOTS:**
   ```bash
   npm start
   ```

5. **Link Account:** Scan the QR code displayed in your terminal using WhatsApp → Linked Devices.

---

# 🧩 Adding New Commands

EDBOTS makes it easy to add features. Create a `.js` file anywhere inside the `commands/` folder using this template:

```javascript
/**
 * @file example.js
 */
module.exports = {
    name: "hello",             // Command trigger
    aliases: ["hi", "hey"],     // Optional shortcuts
    async execute(sock, msg, args) {
        const jid = msg.key.remoteJid;
        await sock.sendMessage(jid, { text: "Hello! EDBOTS is working." });
    }
};
```

---

# 👨‍💻 Developer Information

- **Developer:** Edun Oluwadarasimi David
- **Email:** [davidedun2010@gmail.com](mailto:davidedun2010@gmail.com)
- **Repository:** [GitHub: EDBOTS](https://github.com/edunoluwadarasimidavid/EDBOTS.git)

> **Note:** Modification of developer metadata in `core/developer.js` is strictly prohibited by the system's integrity engine.

---

# 📜 License

This project is licensed under the **MIT License**.

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:2c5364,50:203a43,100:0f2027&height=120&section=footer"/>

### Built with Precision • Refactored for Excellence • Powered by Baileys MD

</div>
