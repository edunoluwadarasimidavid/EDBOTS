<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f2027,50:203a43,100:2c5364&height=180&section=header&text=EDBOTS+V3+PRO&fontSize=50&fontColor=ffffff&animation=fadeIn&fontAlignY=35"/>

# 🤖 EDBOTS V3: The Industrial-Grade WhatsApp Framework
### Advanced • Secure • Modular • Terminal-Optimized

<br/>

[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Baileys MD](https://img.shields.io/badge/Baileys-Multi%20Device-00bcd4?style=for-the-badge)](https://github.com/WhiskeySockets/Baileys)
[![Architecture](https://img.shields.io/badge/Architecture-Modular-blueviolet?style=for-the-badge)](https://github.com/edunoluwadarasimidavid/EDBOTS)
[![Security](https://img.shields.io/badge/Security-Anti--Tamper-red?style=for-the-badge)](https://github.com/edunoluwadarasimidavid/EDBOTS)

</div>

---

# 🌍 Overview

**EDBOTS V3** is a high-performance, terminal-based WhatsApp automation framework built on the **Baileys Multi-Device (MD)** library. This version represents a significant upgrade from previous iterations, focusing on stability, speed, and uncompromising security.

---

# 🚀 Latest Improvements (March 2026)

The framework has been recently optimized for maximum reliability and ease of use:

- **High-Grade Update System**: 
    - **Non-Git Update Mechanism**: Downloads the entire repository as a ZIP archive, extracts it, and updates all system files automatically.
    - **Session Protection**: Specifically designed to exclude the `session/` folder, ensuring authentication is never broken during updates.
    - **Automatic Cleanup**: Clears temporary update cache immediately after completion.
    - **Live Notification**: Sends a detailed success message to the WhatsApp owner account upon completion.
- **High-Grade Anti-Ban System**: 
    - **Account Warming**: Automatically introduces a "wake up" delay after long periods of inactivity to simulate human behavior.
    - **Dynamic Typing Simulation**: Calculates typing duration based on response length (WPM simulation).
    - **Smart Presence**: Uses `presenceObserve` and `sendPresenceUpdate` to mimic real user interaction before replying.
    - **Global Rate Limiting**: Per-user and global message caps to prevent spam-triggered bans.
- **Puter AI Integration**: Full support for `.auto-reply` using the Puter.js engine with localized instruction sets.
- **Recursive Command Loader**: Commands are now loaded recursively from all subfolders within the `commands/` directory.
- **Dynamic Menu System**: The `.menu` command is now fully dynamic, automatically categorizing all 111+ commands.
- **Dependency-Free Stability**: Critical commands (Sticker, Take, Crop, Truth, etc.) refactored to remove unstable external dependencies.
- **System-Native FFmpeg**: Media utilities now leverage the system's native FFmpeg for superior performance.

---

# 📚 Command List (111+ Total)

### 🛡️ ADMIN
- **antigroupmention**: Configure antigroupmention protection (delete/kick)
- **antilink**: Configure antilink protection (delete/kick)
- **antitag**: Configure anti-tag protection (tagall/hidetag)
- **autosticker**: Enable or disable auto-sticker conversion
- **clean**: Clean messages (all or from specific user)
- **delete**: Delete a replied message
- **demote**: Remove admin privileges from member
- **goodbye**: Enable/disable goodbye messages
- **grouplink**: Get group invite link
- **hidetag**: Silently tag all members in the group
- **kick**: Remove a participant from the group
- **mute**: Close group (only admins can send messages)
- **promote**: Promote member to admin
- **resetwarn**: Reset all warnings for a user
- **setgoodbye**: Set custom goodbye message
- **setwelcome**: Set custom welcome message
- **tagall**: Tag all group members
- **unmute**: Open group (all members can send messages)
- **warn**: Warn a user
- **welcome**: Enable/disable welcome messages

### 🧠 AI & AUTOMATION
- **ai**: Chat with AI (ChatGPT-style)
- **imagine**: Generate AI art from text prompt
- **auto-reply**: Enable/disable AI auto-reply system

### 🎮 FUN & GAMES
- **truth**: Get a random truth question
- **dare**: Get a random dare challenge
- **joke**: Get random joke
- **meme**: Get random memes
- **memesearch**: Search and get memes/gifs
- **ship**: Ship two users randomly
- **gayrate**: Playful gay percentage check
- **insult**: Give a silly insult to a user
- **compliment**: Get a random compliment
- **flirt**: Get a random flirty pickup line
- **pies**: Get random pies images by country

### 🎨 TEXT & MEDIA
- **sticker**: Convert image or video to sticker
- **crop**: Convert image to cropped sticker
- **take**: Steal a sticker and change its packname
- **simage**: Convert sticker to image (PNG) or video (MP4)
- **attp**: Create animated text sticker
- **tts**: Convert text to speech (TTS-Nova)
- **1917, arena, blackpink, devil, fire, glitch, hacker, ice, impressive, leaves, light, matrix, metallic, neon, purple, sand, snow, thunder**: Advanced text effects

### 📥 DOWNLOADER
- **song**: Download audio from YouTube
- **ytvideo**: Download video from YouTube
- **tiktok**: Download TikTok videos
- **lyrics**: Get lyrics of a song
- **facebook**: Download Facebook videos (Currently undergoing maintenance)
- **instagram**: Download Instagram posts/reels (Currently undergoing maintenance)
- **igs**: Download Instagram Stories (Currently undergoing maintenance)

### 🛠️ UTILITIES
- **weather**: Get weather for a city
- **translate**: Translate text to different languages
- **calc**: Calculate math expressions
- **qr**: Generate QR code from text
- **ssweb**: Take a screenshot of a website
- **ping**: Check system latency
- **uptime**: Show how long the bot has been running
- **botinfo**: Display information about the bot
- **groupinfo**: Show group information
- **groupstats**: Show today's group chat statistics
- **myactivity**: Check your personal activity stats

### 🔞 ANIME (SFW/NSFW)
- **waifu, neko, konachan, random**: SFW Anime images
- **hwaifu, hneko, loli, megumin, milf**: NSFW Anime images (Requires appropriate permissions)

### 👑 OWNER ONLY
- **mode**: Toggle between Public/Self mode
- **prefix**: Change the bot global prefix
- **broadcast**: Send message to all chats
- **block/unblock**: Manage blocked users
- **setbotname/setbotpp**: Customize bot identity
- **restart/update**: System maintenance and updates

---

# 🛡️ Advanced Anti-Tamper & Security

EDBOTS V3 is built with a multi-layered security architecture:

- **Integrated Anti-Tamper System:** Active monitoring for critical file modifications.
- **Immutable Developer Metadata:** Cryptographically verified identities.
- **Runtime Integrity Audit:** Exhaustive self-audit on every startup.
- **Secure Sandboxed Execution:** Hardened environment for command execution.
- **Global Error Shielding:** Prevents crashes from unexpected errors.

---

# 🏗️ Modular Architecture

```text
edbots/
├── core/                # [ENGINE] Optimized Baileys connection and routing
├── commands/            # [MODULES] 111+ Categorized commands in subfolders
├── config/              # [CONFIG] User-editable bot preferences
├── utils/               # [HELPERS] Reusable system and media utilities
├── data/                # [DATA] Dynamic command metadata and overrides
├── session/             # [DATA] Encrypted authentication storage
└── index.js             # [ENTRY] Secure initialization point
```

---

# 👨‍💻 Developer & Support

- **Lead Developer:** Edun Oluwadarasimi David
- **Email:** [davidedun2010@gmail.com](mailto:davidedun2010@gmail.com)

---

# 📜 License

This software is **Proprietary and Private**. Unauthorized redistribution, modification, or reverse engineering of this software is strictly prohibited. All rights reserved by the original developer.

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:2c5364,50:203a43,100:0f2027&height=120&section=footer"/>

### Built with Precision • Hardened for Security • Powered by Baileys MD

</div>
