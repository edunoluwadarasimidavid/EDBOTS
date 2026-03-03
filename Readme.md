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
| 🌐 Web Pairing | ✅ Live | Pair via website (no terminal QR needed) |
| 🧩 Modular Commands | ✅ Working | Add commands inside `/commands` |
| 👑 Owner System | ✅ Working | Restricted admin commands |
| 👥 Group Management | ✅ Working | Anti-link, moderation tools |
| ⚡ Lightweight Core | ✅ Optimized | Efficient memory handling |
| 🔄 Auto Reconnect | ✅ Enabled | Handles disconnect events |
| 🎨 Config Customization | ✅ Editable | Customize via `config.js` |

---

# 🔗 Pairing Website (Live)

Pair your WhatsApp using:

👉 https://edbotsserver.onrender.com

Steps:

1. Open the link
2. Enter your phone number
3. Receive pairing code
4. Enter code in WhatsApp → Linked Devices

No QR terminal required.

---

# 📁 Project Structure

```
EDBOTS/
├── commands/
│   ├── ping.js
│   ├── owner.js
│   └── group.js
├── session/
├── utils/
├── config.js
├── index.js
└── package.json
```

Clean. Maintainable. Scalable.

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

Add to `config.js`:

```js
sessionID: 'YOUR_SESSION_STRING'
```

Or use environment variable:

```
SESSION_ID=YOUR_SESSION_STRING
```

---

## 2️⃣ QR Login (Optional)

Leave:

```js
sessionID: ''
```

Then run:

```bash
node index.js
```

Scan QR from WhatsApp → Linked Devices.

---

# 🚀 Deployment Options

EDBOTS supports:

- Render
- VPS
- Docker
- Railway
- Any Node.js hosting platform

Recommended Node.js version: **18 or 20**

---

# ⚙ Configuration

Edit `config.js`:

```js
module.exports = {
  botName: "EDBOTS",
  ownerNumber: "234XXXXXXXXXX",
  prefix: ".",
  sessionID: ""
}
```

---

# 📢 Official WhatsApp Channel

<a href="https://whatsapp.com/channel/0029Vb7L1ofDDmFQRaKotG0f">
<img src="https://img.shields.io/badge/Join-WhatsApp%20Channel-25D366?style=for-the-badge&logo=whatsapp&logoColor=white"/>
</a>

---

# 📊 Repository Stats

<img src="https://github-readme-stats.vercel.app/api?username=edunoluwadarasimidavid&show_icons=true&theme=tokyonight&hide_border=true" height="170"/>

<img src="https://github-readme-streak-stats.herokuapp.com/?user=edunoluwadarasimidavid&theme=tokyonight&hide_border=true"/>

---

# 👨‍💻 Developer

Edun Oluwadarasimi David  
Website: https://edunoluwadarasimidavid.name.ng  
Email: davidedun2010@gmail.com  
Repository: https://github.com/edunoluwadarasimidavid/EDBOTS.git  

---

# ⚠ Disclaimer

- Not affiliated with WhatsApp Inc.
- Use responsibly.
- Avoid spam or abuse.
- Educational and automation purposes only.

---

# 📜 License

MIT License

You may:
- Modify
- Rebrand
- Distribute
- Extend

In compliance with MIT terms.

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:2c5364,50:203a43,100:0f2027&height=120&section=footer"/>

### Powered by Baileys MD • Built with precision

</div>
