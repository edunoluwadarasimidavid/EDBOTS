<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f2027,50:203a43,100:2c5364&height=180&section=header&text=EDBOTS+AI+V4&fontSize=50&fontColor=ffffff&animation=fadeIn&fontAlignY=35"/>

# 🤖 EDBOT AI SYSTEM: The Professional WhatsApp Framework
### Advanced • Intelligent • Secure • Modular • AI-Powered • CLI-Ready

<br/>

[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Baileys MD](https://img.shields.io/badge/Baileys-Multi%20Device-00bcd4?style=for-the-badge)](https://github.com/WhiskeySockets/Baileys)
[![AI Powered](https://img.shields.io/badge/AI-Powered-ff6f00?style=for-the-badge&logo=openai&logoColor=white)](https://github.com/edunoluwadarasimidavid/EDBOTS)
[![Architecture](https://img.shields.io/badge/Architecture-Modular-blueviolet?style=for-the-badge)](https://github.com/edunoluwadarasimidavid/EDBOTS)

</div>

---

# 🌍 Overview

**EDBOT AI SYSTEM** is a premium, industrial-grade WhatsApp automation framework with **built-in AI capabilities** and a **professional CLI**. Built on **Baileys Multi-Device (MD)** and optimized for **Node.js 18+**, it features multi-provider AI, business tools, smart conversations, version management with rollback, and 100+ commands.

---

# 🚀 Quick Start

### Install
```bash
# Install globally (recommended)
npm install -g edbots

# Or from source
git clone https://github.com/EDBOTS/EDBOTS.git
cd EDBOTS
npm install
```

### Start
```bash
# Using CLI (recommended)
edbots start

# Or traditional
npm start
```

### First-Time Setup
```
EDBots Pairing

No WhatsApp account is connected.

Choose a connection method:

  [1] Pairing Code
  [2] QR Code

Select an option: _
```

- **Option 1 (Pairing Code):** Enter your phone number, get a code to link
- **Option 2 (QR Code):** Scan QR with WhatsApp → Linked Devices
- **Auto-Fallback:** If no selection in 10 seconds, QR mode activates automatically

---

# 🖥️ CLI Commands

EDBots includes a professional CLI for managing your bot:

```bash
edbots start              # Start the bot
edbots start --qr         # Start with QR code
edbots start --pair       # Start with pairing code
edbots customize          # Interactive configuration wizard
edbots pair               # Pair with WhatsApp
edbots pair --qr          # Pair using QR code
edbots pair --code        # Pair using phone number
edbots status             # Show bot status
edbots settings           # Manage bot settings
edbots plugins            # List all plugins
edbots logs               # View bot logs
edbots logs --follow      # Follow logs in real-time
edbots restart            # Restart the bot
edbots stop               # Stop the bot gracefully
edbots update             # Check for updates
edbots update --apply     # Apply latest update
edbots logout             # Disconnect WhatsApp & reset session
edbots logout --force     # Logout without confirmation
edbots reset              # Reset configuration to defaults
edbots reset --all        # Reset config AND logout
edbots doctor             # Diagnose common problems
edbots --version          # Show version
edbots --help             # Show help
```

### Logging Out & Resetting

```bash
# Disconnect WhatsApp account (keeps your settings)
edbots logout
# After logout, `edbots start` asks for fresh pairing (QR or code)

# Reset all configuration to factory defaults (keeps session)
edbots reset

# Full reset: configuration AND session
edbots reset --all

# Diagnose problems (Node, FFmpeg, deps, config, session)
edbots doctor
```

### Interactive Configuration
```bash
edbots customize
```

Walks you through all settings with a clean wizard:

```
━━━ IDENTITY ━━━

Bot display name [EDBots]: David Bot
Bot description [Advanced WhatsApp AI Bot...]: My personal assistant
Command prefix [.]: !
Owner name [EDBots]: David
Owner number []: 2348012345678
Timezone [Africa/Lagos]: UTC

━━━ MESSAGE BEHAVIOR ━━━

Auto-read messages? (Y/n): y
Auto-typing indicator? (Y/n): n
AI auto-reply? (Y/n): y

━━━ GROUP BEHAVIOR ━━━

Welcome messages? (Y/n): y
Anti-link protection? (Y/n): y
```

**Press ENTER to keep current values.**

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
- **`.biz on/off`** - Quick business mode toggle
- **Auto-Responder** - Smart AI auto-reply with keyword learning
- **Product Catalog** - Manage products with QR codes
- **Invoice Generator** - Create professional invoices
- **Business AI** - Generate social posts, emails, ads
- **Analytics Dashboard** - Track messages, contacts, and insights

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

### 🔄 Version Management
- **`.updates`** - View version info and changelog
- **`.rollback`** - Rollback to previous versions
- **GitHub Releases** - Proper versioning with release notes
- **Auto-Backup** - Automatic backup before updates

### 🎮 Engaging Group Features
- **Trivia Game** - 50+ questions with leaderboards
- **Daily Challenges** - Complete tasks for points
- **Weekly Challenges** - Big rewards for consistency
- **Challenge Leaderboard** - Compete with group members

### 🛡️ Advanced Anti-Ban System
- **Human-Like Typing** - Variable speed based on message complexity
- **Burst Protection** - Prevents rapid-fire messages
- **Graduated Penalties** - Increasing cooldowns for violations
- **Time-of-Day Awareness** - Different behavior at different hours
- **Circuit Breaker** - Stops if too many errors occur

### 📰 Free API Integrations
- **Fun Facts** - Random interesting facts
- **Jokes** - Programming and general jokes
- **Quotes** - Inspirational quotes
- **Horoscope** - Daily horoscope readings
- **News Headlines** - Latest news from various categories
- **Reddit Posts** - Content from Reddit communities
- **Wikipedia** - Search and summaries

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
| `.biz on/off` | Quick business mode toggle |
| `.biz status` | View business settings |
| `.biz welcome` | Configure welcome messages |
| `.biz hours` | Set business hours |
| `.biz greeting` | Set greeting message |
| `.biz quickreply` | Toggle AI quick replies |
| `.bizai social <topic>` | Generate social media posts |
| `.bizai email <topic>` | Write professional emails |
| `.bizai ad <topic>` | Create ad copy |
| `.catalog add/list` | Product catalog management |
| `.invoice` | Generate invoices |
| `.autoresponder` | Business auto-reply system |
| `.analytics` | Business analytics dashboard |
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
| `.fact` | Random fun fact |
| `.fact joke` | Random joke |
| `.fact quote` | Inspirational quote |
| `.fact horoscope <sign>` | Daily horoscope |
| `.fact catfact` | Cat fact |
| `.fact dogfact` | Dog fact |
| `.fact advice` | Life advice |
| `.fact bored` | Activity suggestion |

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
| `.news` | Latest news headlines |
| `.news reddit` | Reddit posts |
| `.news wiki` | Wikipedia summary |

### 🛡️ Admin & Group
| Command | Description |
|---------|-------------|
| `.trivia` | Interactive trivia game |
| `.trivia leaderboard` | Trivia leaderboard |
| `.challenge daily` | Daily challenges |
| `.challenge weekly` | Weekly challenges |
| `.challenge progress` | Your challenge progress |
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
| `.notify` | Manage notifications & alerts |

### 📥 Media & Downloads
| Command | Description |
|---------|-------------|
| `.song` | YouTube audio download |
| `.video` | YouTube video download |
| `.tiktok` | TikTok download |
| `.sticker` | Image/video to sticker |
| `.tts` | Text to speech |

### 🔄 Version & Updates
| Command | Description |
|---------|-------------|
| `.updates` | Show version info and changelog |
| `.updates check` | Check for updates |
| `.updates history` | Version history |
| `.updates changelog` | Full changelog |
| `.rollback` | Show available versions |
| `.rollback <version>` | Rollback to version |
| `.rollback confirm` | Confirm rollback |

---

# 🛡️ Security & Integrity

- **RBAC Engine** - 5-layer permission system
- **Advanced Anti-Ban** - Human-like behavior simulation
- **Session Encryption** - Atomic write protection
- **Audit Logging** - Real-time security alerts
- **Self-Repair** - Automatic dependency validation
- **Circuit Breaker** - Stops on consecutive errors
- **Backup System** - Automatic backups before updates

---

# 🛠️ Installation

### Method 1: Global Install (Recommended)
```bash
npm install -g edbots
edbots start
```

### Method 2: From Source
```bash
git clone https://github.com/EDBOTS/EDBOTS.git
cd EDBOTS
npm install
edbots start
# or: npm start
```

### Method 3: Using npx
```bash
npx edbots start
```

### Requirements
- **Node.js 18+**
- **FFmpeg** (for media processing)

### AI Setup (Optional)
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
EDBOTS/
├── src/
│   ├── cli/                   # [CLI] Command-line interface
│   │   ├── index.js           # CLI entry point
│   │   ├── commands/          # CLI commands (start, customize, etc.)
│   │   └── ui/                # UI helpers (prompts, spinner, logger)
│   └── config/
│       ├── manager.js         # Centralized config manager
│       └── defaults.js        # Default configuration values
├── core/                      # [ENGINE] Connection, handler, security
│   ├── connection.js          # Baileys connection manager
│   ├── handler.js             # Message handler with RBAC
│   └── engine.js              # Bot orchestrator
├── commands/                  # [MODULES] 100+ commands
│   ├── ai/                    # AI-powered commands
│   ├── business/              # Business tools (biz, analytics, catalog)
│   ├── fun/                   # Games and entertainment
│   ├── general/               # Public commands
│   ├── group/                 # Group management (trivia, challenges)
│   ├── media/                 # Media downloads
│   ├── owner/                 # Owner-only controls
│   ├── system/                # System commands (updates, rollback)
│   ├── utility/               # Utility tools (news, crypto, etc.)
│   └── textmaker/             # Text effects
├── utils/                     # [HELPERS] Core utilities
│   ├── aiProviders.js         # Multi-provider AI system
│   ├── aiEngine.js            # Unified AI engine
│   ├── advancedAntiBan.js     # Advanced anti-ban system
│   ├── smartAutoReply.js      # Smart auto-reply with learning
│   ├── conversationMemory.js  # Smart memory system
│   ├── modeManager.js         # Mode switching
│   ├── versionManager.js      # Version management & rollback
│   ├── notifications.js       # Smart notification system
│   ├── freeApis.js            # Free API integrations
│   └── commandLoader.js       # Command auto-loader
├── data/                      # [DATA] Persistent storage
├── config.js                  # [CONFIG] Legacy bot configuration
├── bot_version.json           # [VERSION] Version info & changelog
├── package.json               # [PACKAGE] NPM configuration
└── index.js                   # [ENTRY] Application entry (legacy)
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

# 🔄 Version Management

### Viewing Version
```bash
.updates              # Show current version and changelog
.updates check        # Check for updates from GitHub
.updates history      # View version history
.updates changelog    # Show detailed changelog
```

### Rolling Back
```bash
.rollback             # Show available versions
.rollback 1.0.0       # Preview rollback to v1.0.0
.rollback confirm 1.0.0  # Confirm and execute rollback
```

### Version Format
```json
{
  "version": "2.0.0",
  "codename": "Phoenix",
  "changelog": [
    { "type": "added", "description": "New feature" },
    { "type": "fixed", "description": "Bug fix" },
    { "type": "changed", "description": "Change description" }
  ]
}
```

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
### Professional Framework • AI-Powered • CLI-Ready • Powered by Baileys MD

</div>
