<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f2027,50:203a43,100:2c5364&height=180&section=header&text=EDBOTS&fontSize=50&fontColor=ffffff&animation=fadeIn&fontAlignY=35"/>

# 🤖 EDBOTS  
### Production-Ready WhatsApp Multi-Device Automation Framework

<br/>

<img src="https://readme-typing-svg.herokuapp.com?font=Poppins&size=22&duration=4000&color=00F5FF&center=true&vCenter=true&width=650&lines=Multi-Device+WhatsApp+Bot;Secure+Session+Pairing;Modular+Command+System;Optimized+For+Cloud+Deployment;Built+With+Baileys+MD"/>

<br/>

<img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white"/>
<img src="https://img.shields.io/badge/Baileys-Multi%20Device-00bcd4?style=for-the-badge"/>
<img src="https://img.shields.io/badge/Pairing-Live-success?style=for-the-badge"/>
<img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge"/>
<img src="https://img.shields.io/github/stars/edunoluwadarasimidavid/EDBOTS?style=for-the-badge"/>
<img src="https://img.shields.io/github/forks/edunoluwadarasimidavid/EDBOTS?style=for-the-badge"/>

</div>

---

# 🌍 Overview

**EDBOTS** is a scalable WhatsApp Multi-Device automation framework built using the Baileys MD library.

It is designed for:

- ⚡ High performance and stability
- 🔐 Secure session handling
- 🧩 Modular command structure
- 🌐 Cloud-ready deployment
- 🛠 Developer customization

This project is open-source and production-structured.

---

# ✨ Working Features

| Feature | Status | Description |
|----------|--------|------------|
| 🔐 Multi-Device Login | ✅ Working | Compatible with latest WhatsApp MD |
| 🤖 Puter.js AI | ✅ Added | Free AI models (GPT-4o-mini, etc.) |
| 💬 AI Auto-Reply | ✅ Added | Toggleable AI for all messages |
| 🌐 Cloudflare Tunnel | ✅ Added | Secure auth link via `cloudflared` |
| 👥 Group AI | ✅ New | Respond to `.edbot-ai` only |
| 📩 Private AI | ✅ New | Greeting detection & `ai:` shortcut |
| 🔑 Keyword Replies | ✅ New | Configurable auto-replies in `data/` |
| 🌐 Web Pairing | ✅ Live | Pair via website (no terminal QR needed) |
| 🧩 Modular Commands | ✅ Working | Add commands inside `/commands` |
| 👑 Owner System | ✅ Working | Restricted admin commands |
| 👥 Group Management | ✅ Working | Anti-link, moderation tools |
| ⚡ Lightweight Core | ✅ Optimized | Efficient memory handling |
| 🔄 Auto Reconnect | ✅ Enabled | Handles disconnect events |
| 🎨 Config Customization | ✅ Editable | Customize via `config.js` |

---

# 🤖 AI Integration (Puter.js)

EDBOTS features integrated AI using **Puter.js**, providing free access to powerful models like GPT-4o-mini without needing manual API keys.

### 🚀 AI Commands

| Command | Usage | Description |
|---------|-------|-------------|
| `.edbot-ai <q>` | Global | Asks AI a question (Works in Group/Private) |
| `.ai <question>`| Global | Shorter alias for `.edbot-ai` |
| `ai: <question>` | Private | Quick AI shortcut in private chat |
| `.auto-reply on` | Owner | Enables global AI auto-reply (Generates Auth Link) |
| `.auto-reply off` | Owner | Disables AI and removes stored session |

### 🔐 Authentication (Cloudflare Tunnel)

To connect the AI, use `.auto-reply on`. The bot will automatically:
1. Start a local secure server.
2. Create a public tunnel using **Cloudflare** (`cloudflared`).
3. Generate a secure `puter.com` authentication link.
4. Automatically detect and save your session once you log in.

### 🧠 Intelligent Routing

- **Groups:** The AI only triggers when specifically called using `.edbot-ai` or `.ai`. Normal messages are ignored to prevent spam.
- **Private Chat:** 
  - **Auto-Reply Mode:** If enabled, the bot answers *every* message using AI (excluding commands).
  - **Greeting Detection:** Detects "hi", "hello", etc., and sends an interactive menu.
  - **Keyword Matching:** Prioritizes manual keywords from `data/commandFile.json`.
  - **Shortcut:** Supports `ai: <question>` even if auto-reply is off.

### ⚙ AI Customization

Customize personality and model in `ai/instructions.json`:

```json
{
  "system_prompt": "You are EDBOTS AI assistant...",
  "model": "gpt-4o-mini"
}
```

---

# 📁 Project Structure

```
EDBOTS/
├── commands/
│   ├── group/        # Group-specific commands
│   ├── ownerAI/      # Private chat AI logic
│   └── ...           # General commands
├── data/             # JSON data for menus & keywords
├── utils/
│   ├── aiEngine.js   # Centralized AI interface
│   └── puterAI.js    # Puter.js connection logic
├── config.js
├── handler.js        # Main message router
└── index.js
```

---

# 🛠 Local Installation

```bash
git clone https://github.com/edunoluwadarasimidavid/EDBOTS.git
cd EDBOTS
npm install
node index.js
```

---

# 🔐 Authentication Methods

## 1️⃣ Session String

Add to `config.js` or use `SESSION_ID` environment variable.

---

## 2️⃣ QR Login (Optional)

Run `node index.js` and scan the QR from WhatsApp → Linked Devices.

---

# 🚀 Deployment Options

EDBOTS supports VPS, Docker, Railway, Render, and Pterodactyl. The tunnel system is optimized for restricted container environments using Cloudflare Quick Tunnels.

---

# 👨‍💻 Developer

Edun Oluwadarasimi David  
Website: https://edunoluwadarasimidavid.name.ng  
Email: davidedun2010@gmail.com  
Repository: https://github.com/edunoluwadarasimidavid/EDBOTS.git  

---

# 📜 License

MIT License

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:2c5364,50:203a43,100:0f2027&height=120&section=footer"/>

### Powered by Baileys MD • Built with precision

</div>
