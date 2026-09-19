<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f2027,50:203a43,100:2c5364&height=180&section=header&text=EDBOTS+AI+V4&fontSize=50&fontColor=ffffff&animation=fadeIn&fontAlignY=35"/>

# 🤖 EDBOT AI SYSTEM: The Professional WhatsApp Framework
### Advanced • Intelligent • Secure • Modular • AI-Powered

<br/>

[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Baileys MD](https://img.shields.io/badge/Baileys-Multi%20Device-00bcd4?style=for-the-badge)](https://github.com/WhiskeySockets/Baileys)
[![AI Powered](https://img.shields.io/badge/AI-Powered-ff6f00?style=for-the-badge&logo=openai&logoColor=white)](https://github.com/edunoluwadarasimidavid/EDBOTS)
[![Architecture](https://img.shields.io/badge/Architecture-Modular-blueviolet?style=for-the-badge)](https://github.com/edunoluwadarasimidavid/EDBOTS)

</div>

---

# 🌍 Overview

**EDBOT AI SYSTEM** is a premium, industrial-grade WhatsApp automation framework with **built-in AI capabilities**. Built on **Baileys Multi-Device (MD)** and optimized for **Node.js 18+**, it features multi-provider AI, business tools, smart conversations, and 100+ commands.

---

# 🚀 Key Features

### 🤖 Multi-Provider AI System
- **Puter AI** (Primary) - Free, no API key needed
- **Groq** - Fastest inference (free tier)
- **SambaNova** - High-quality responses (free tier)
- **OpenRouter** - Many free models available
- **HuggingFace** - Open-source models (free tier)
- **Ollama** - Local AI support for privacy

### 💼 Business Mode
- **Auto-Responder** - Smart auto-reply templates
- **Product Catalog** - Manage products with QR codes
- **Invoice Generator** - Create professional invoices
- **Business AI** - Generate social posts, emails, ads
- **Analytics** - Track group activity and insights

### 🧠 Smart Features
- **Conversation Memory** - Remembers context across chats
- **User Profiles** - Tracks preferences and mood
- **Knowledge Base** - Store and retrieve information
- **Sentiment Analysis** - Detects positive/negative/neutral
- **Language Detection** - Auto-detects 20+ languages

### 🎯 Mode System
- **Personal** 👤 - Full personal assistant
- **Business** 💼 - Professional business tools
- **Group** 👥 - Group management and moderation
- **Owner** 👑 - Full admin control

---

# 📚 Complete Command List

### 🧠 AI & Smart Features
| Command | Description |
|---------|-------------|
| `.chat` | Smart AI with context memory |
| `.chat learn <key> <value>` | Teach the bot new information |
| `.chat profile` | View your user profile |
| `.ai` | Direct AI question |
| `.imagine` | AI image generation |
| `.summarize` | AI text summarization |
| `.analyze` | Text sentiment & statistics |
| `.translate` | 60+ language translation |
| `.ollama` | Local Ollama AI |

### 💼 Business Tools
| Command | Description |
|---------|-------------|
| `.bizai social <topic>` | Generate social media posts |
| `.bizai email <topic>` | Write professional emails |
| `.bizai ad <topic>` | Create ad copy |
| `.catalog add/list` | Product catalog management |
| `.invoice` | Generate invoices |
| `.autoresponder` | Business auto-reply system |
| `.setmode business` | Switch to business mode |

### 🎮 Fun & Games
| Command | Description |
|---------|-------------|
| `.rps` | Rock Paper Scissors |
| `.wyr` | Would You Rather |
| `.emoji` | Text to emoji translator |
| `.reverse` | Reverse text |
| `.fortune` | Fortune cookie |
| `.quote` | Inspirational quotes |
| `.ship` | Ship two users |

### 🔧 Utility Tools
| Command | Description |
|---------|-------------|
| `.remind` | Smart reminders with natural language |
| `.poll` | Create interactive polls |
| `.qrgen` | QR code generator |
| `.forecast` | Advanced weather forecast |
| `.wiki` | Wikipedia search |
| `.urban` | Urban Dictionary lookup |
| `.crypto` | Crypto price tracker |
| `.convert` | Binary/Hex/Base64 converter |
| `.shorten` | URL shortener |
| `.contact` | Contact card generator |

### 🛡️ Admin & Group
| Command | Description |
|---------|-------------|
| `.automod` | Auto-moderation tools |
| `.spamfilter` | Anti-spam protection |
| `.insights` | Group analytics |
| `.antilink` | Link protection |
| `.welcome` | Welcome messages |
| `.tagall` | Tag all members |

### 👑 Owner Controls
| Command | Description |
|---------|-------------|
| `.setmode` | Switch bot mode |
| `.smartbc` | Smart broadcast with analytics |
| `.sudo` | Manage trusted users |
| `.backup` | Database backup |
| `.broadcast` | Broadcast to all groups |
| `.update` | System update |

### 📥 Media & Downloads
| Command | Description |
|---------|-------------|
| `.song` | YouTube audio download |
| `.video` | YouTube video download |
| `.tiktok` | TikTok download |
| `.sticker` | Image/video to sticker |
| `.tts` | Text to speech |

---

# 🛡️ Security & Integrity

- **RBAC Engine** - 5-layer permission system
- **Anti-Ban System** - WPM-based human simulation
- **Session Encryption** - Atomic write protection
- **Audit Logging** - Real-time security alerts
- **Self-Repair** - Automatic dependency validation

---

# 🛠️ Installation

### 1. Requirements
- **Node.js 18+**
- **FFmpeg** (for media processing)

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure
Edit `config.js` to set your owner number and preferences.

### 4. Start
```bash
npm start
```

### 5. AI Setup (Optional)
For enhanced AI, set one or more environment variables:
```bash
# Free AI providers (sign up for free)
GROQ_API_KEY=your_key          # console.groq.com
SAMBANOVA_API_KEY=your_key     # cloud.sambanova.ai
OPENROUTER_API_KEY=your_key    # openrouter.ai
```

---

# 🏗️ Architecture

```text
edbots-system/
├── core/                    # [ENGINE] Connection, handler, security
│   ├── connection.js        # Baileys connection manager
│   ├── handler.js           # Message handler with RBAC
│   └── engine.js            # Bot orchestrator
├── commands/                # [MODULES] 100+ commands
│   ├── ai/                  # AI-powered commands
│   ├── business/            # Business tools
│   ├── fun/                 # Games and entertainment
│   ├── general/             # Public commands
│   ├── group/               # Group management
│   ├── media/               # Media downloads
│   ├── owner/               # Owner-only controls
│   ├── utility/             # Utility tools
│   └── textmaker/           # Text effects
├── utils/                   # [HELPERS] Core utilities
│   ├── aiProviders.js       # Multi-provider AI system
│   ├── aiEngine.js          # Unified AI engine
│   ├── conversationMemory.js # Smart memory system
│   ├── modeManager.js       # Mode switching
│   ├── antiBan.js           # Anti-ban protection
│   └── commandLoader.js     # Command auto-loader
├── database/                # [DATA] Persistent storage
├── config.js                # [CONFIG] Bot configuration
└── index.js                 # [ENTRY] Application entry
```

---

# 📊 Command Visibility

Commands have three visibility levels:

| Level | Description |
|-------|-------------|
| `public` | Shown to everyone in `.start` and `.menu` |
| `private` | Only shown to owner/admin |
| `hidden` | Never shown in menus |

---

# ⚖️ Disclaimer

**EDBOT AI SYSTEM** is an independent automation framework. It is **not affiliated with WhatsApp or Meta**. Users are responsible for their usage. Must not be used for spam or unlawful activity.

---

# 👨‍💻 Development & Support

- **Lead Architect:** Edun Oluwadarasimi David
- **Email:** [davidedun2010@gmail.com](mailto:davidedun2010@gmail.com)
- **GitHub:** [https://github.com/EDBOTS](https://github.com/EDBOTS)

---

# 📜 License

Proprietary and Private. All rights reserved.

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:2c5364,50:203a43,100:0f2027&height=120&section=footer"/>

### EDBOT AI SYSTEM • Intelligent Automation Engine • Built by Smart Tech Programming
### Professional Framework • AI-Powered • Powered by Baileys MD

</div>
