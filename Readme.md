<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f2027,50:203a43,100:2c5364&height=180&section=header&text=EDBOTS+V3+PRO&fontSize=50&fontColor=ffffff&animation=fadeIn&fontAlignY=35"/>

# 🤖 EDBOT AI SYSTEM: The Professional WhatsApp Framework
### Advanced • Secure • Modular • Role-Based • Intelligent

<br/>

[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Baileys MD](https://img.shields.io/badge/Baileys-Multi%20Device-00bcd4?style=for-the-badge)](https://github.com/WhiskeySockets/Baileys)
[![Architecture](https://img.shields.io/badge/Architecture-Modular-blueviolet?style=for-the-badge)](https://github.com/edunoluwadarasimidavid/EDBOTS)
[![Security](https://img.shields.io/badge/Security-RBAC--Hardened-red?style=for-the-badge)](https://github.com/edunoluwadarasimidavid/EDBOTS)

</div>

---

# 🌍 Overview

**EDBOT AI SYSTEM** (formerly EDBOTS V3) is a premium, industrial-grade WhatsApp automation framework. Built on the **Baileys Multi-Device (MD)** library and optimized for **Node.js 18+**, it provides a high-performance environment for intelligent automation, system-level management, and secure communication.

---

# 💎 Premium Features & Upgrades (March 2026)

The framework has been transformed into a professional **Role-Based Intelligent System**:

- **Premium EDBOT AI System Menu**:
    - **Intelligent Architecture**: Rebuilt from the ground up as a framework interface, not just a list of commands.
    - **Context-Aware Filtering**: Automatically filters commands based on the user's role (Owner, Admin, Group, Private) and current chat environment.
    - **Split-Menu Support**: Specialized menus for public, group, admin, and owner commands.
    - **Dynamic Identity Sync**: Header automatically displays live bot number, profile name, and system uptime.
    - **Premium Visual Blocks**: Professional monospaced formatting with category-based grouping.
- **Advanced Role-Based Access Control (RBAC)**:
    - **Automated Metadata Normalization**: System-wide security fallback that assigns permissions based on command category.
    - **5-Layer Security**: Strict validation for **Owner**, **Admin**, **Group**, **Premium**, and **Self-Mode** permissions.
    - **Direct Session Detection**: Dynamically identifies the connected owner account directly from the WhatsApp session.
    - **Audit Logging**: Real-time security alerts in the terminal for unauthorized access attempts.
    - **Graceful Error Shielding**: Professional permission-denied responses instead of silent failures or crashes.
- **High-Grade Update System**: 
    - **Non-Git Update Mechanism**: ZIP-based updating that preserves your `session/` folder and authentication.
    - **Live Notification**: Detailed system report sent to the owner's WhatsApp upon successful update.
- **High-Grade Anti-Ban System**: 
    - **Human Simulation**: Dynamic typing calculation (WPM-based), account warming, and presence observation.
    - **Direct Baileys Delivery**: Optimized message delivery for self-chats and high-priority commands to ensure 100% visibility.
- **Recursive Command Engine**: Dynamically loads and validates 111+ commands from the `commands/` directory.

---

# 📚 Intelligent Command Menu

Access the system through specialized role-based menus:

### 🎮 SYSTEM NAVIGATION
- **.menu**: Displays public commands (AI, Media, Fun, Utility, etc.)
- **.groupmenu**: Group-specific utilities (Only visible in groups)
- **.adminmenu**: Group moderation tools (Only visible to group admins)
- **.ownermenu**: Full system control (Only visible to the bot owner)
- **.help / .h**: Aliases for the main public menu.

### 🛡️ MODERATION (Admin/Group Menu)
- **antigroupmention, antilink, antitag**: Advanced group protection filters.
- **kick, promote, demote, mute, unmute**: Core participant management.
- **welcome, goodbye, setwelcome, setgoodbye**: Automated member onboarding.
- **tagall, hidetag**: Efficient group-wide communication.
- **warn, resetwarn, clean, delete**: Message and behavioral control.

### 🧠 AI & CREATIVE (Public Menu)
- **ai**: Advanced ChatGPT-integrated assistant.
- **imagine**: Professional text-to-image AI generation.
- **auto-reply**: Autonomous AI response engine (Puter AI).
- **sticker, crop, simage, take**: High-performance media conversion tools.

### 📥 MEDIA & DOWNLOADS (Public Menu)
- **song, ytvideo**: High-quality YouTube downloader.
- **tiktok**: Watermark-free TikTok downloader.
- **lyrics, weather, translate, calc**: Essential daily utilities.
- **1917 ... thunder**: 20+ Premium professional text effects.

### 👑 SYSTEM CONTROL (Owner Menu)
- **mode**: Toggle between Public and Self (Private) operation.
- **prefix**: Change the global system command prefix.
- **broadcast**: Official announcement system to all chats.
- **restart, update**: One-touch system maintenance and framework updates.
- **setbotname, setbotpp**: Live identity and profile customization.

---

# 🛡️ Security & Integrity Audit

EDBOT AI SYSTEM is hardened with a multi-layered security architecture:

- **Integrated RBAC Engine:** Active permission monitoring for every command call.
- **Immutable Developer Metadata:** Cryptographically verified system identities.
- **Self-Repairing Loader:** Validates command integrity on every startup.
- **Session Protection:** Encrypted authentication storage with backup mechanisms.

---

# 🛠️ Installation & Deployment

### 1. Requirements
Ensure **Node.js 18+** and **FFmpeg** are installed.
```bash
npm install
```

### 2. Configuration
Edit `config.js` to set your primary owner number and system preferences.

### 3. Execution
```bash
npm start
```
Authentication supports both **QR Code** and **Pairing Code** methods.

---

# 🏗️ System Architecture

```text
edbots-system/
├── core/                # [ENGINE] RBAC-Hardened message handler and router
├── commands/            # [MODULES] 111+ Categorized role-based commands
│   ├── admin/           # Admin-only moderation tools
│   ├── owner/           # Owner-only system controls
│   ├── group/           # Group-specific utilities
│   └── ...              # Public categories (AI, Media, Fun, etc.)
├── config/              # [CONFIG] User-editable system preferences
├── utils/               # [HELPERS] Anti-ban, media, and security utilities
├── database/            # [DATA] Persistent JSON-based system storage
└── index.js             # [ENTRY] Secure framework initialization point
```

---

# ⚖️ Disclaimer & Usage Policy

**EDBOT AI SYSTEM** is an independent automation framework developed by **Smart Tech Programming**. It is **not affiliated with, endorsed by, or connected** to WhatsApp or Meta Platforms, Inc.

Users are solely responsible for their usage of this software. EDBOT AI SYSTEM must not be used for spam, unauthorized bulk messaging, or any unlawful activity. The developer assumes no responsibility for account restrictions or damages resulting from improper use.

---

# 👨‍💻 Development & Support

- **Lead Architect:** Edun Oluwadarasimi David
- **Framework Support:** [davidedun2010@gmail.com](mailto:davidedun2010@gmail.com)
- **GitHub:** [https://github.com/EDBOTS](https://github.com/EDBOTS)

---

# 📜 License

This software is **Proprietary and Private**. Unauthorized redistribution, modification, or reverse engineering is strictly prohibited. All rights reserved by the original developer.

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:2c5364,50:203a43,100:0f2027&height=120&section=footer"/>

### EDBOT AI SYSTEM • Intelligent Automation Engine • Built by Smart Tech Programming
### Professional Framework • Hardened for Security • Powered by Baileys MD

</div>
