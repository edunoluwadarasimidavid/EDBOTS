# EDBOTS 🤖

Advanced WhatsApp Multi-Device Bot powered by Baileys — with a built-in secure REST API control layer for the upcoming EDBOTS App.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

---

## ⚠️ Security first

This repository is safe to clone and run, but **never commit any of the following** (all are git-ignored):

- `.env` (your real secrets live here)
- `session/` and `session_backup_*/` (WhatsApp credentials)
- `admin.key` (admin override password file)
- `data/apiKeys.json` (hashed API keys)
- `ai/puter_connection.json` (Puter auth token)

---

## 🚀 Quick start

### 1. Clone the repository

```bash
git clone https://github.com/edunoluwadarasimidavid/EDBOTS.git
cd EDBOTS
```

### 2. Install dependencies

```bash
npm install
```

Requires **Node.js 18+** and **FFmpeg** (for media commands).

### 3. Create your `.env`

```bash
cp .env.example .env
```

Then edit `.env` and set at minimum:

| Variable | Purpose |
|---|---|
| `OWNER_NUMBER` | Your WhatsApp number (digits only) — gets owner commands |
| `BOT_SECRET` | Random string used to encrypt session files |
| `EDBOTS_API_KEY` | Master key for the REST API (or create per-user keys) |

Generate a strong `BOT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

See `.env.example` for every supported variable (bot, REST API, Appwrite, AI providers, CORS, rate limiting) — placeholders only, no real secrets.

### 4. Start EDBOTS

```bash
npm start          # or: node index.js
# Scan the QR code with WhatsApp → Linked Devices
# (or use the CLI: npm run cli)
```

### 5. Start the REST API

The API **starts automatically with the bot** (same process, port `3000` by default). To run it standalone without the bot:

```bash
npm run api        # node api/server.js
```

### 6. Create an API key

Per-user keys let each EDBOTS App user control only their own bot. Keys are stored **only as SHA-256 hashes** — the plaintext is shown once:

```bash
node api/createKey.js "2348012345678" read,write
```

Scopes: `read`, `write`, and optionally `admin`.

---

## 🌐 REST API

Full endpoint documentation lives in **[docs/API.md](docs/API.md)**. Summary:

| Endpoint | Method | Auth |
|---|---|---|
| `/api/health` | GET | public |
| `/api/status` | GET | read |
| `/api/bot/start` · `/api/bot/stop` | POST | write |
| `/api/settings` | GET / PATCH | read / write |
| `/api/commands` | GET | read |
| `/api/commands/{name}/enable\|disable` | POST | write |
| `/api/autoreply` (+ per-chat & keywords) | GET/PATCH/POST/DELETE | read/write |
| `/api/ai` | GET / PATCH | read / write |
| `/api/groups` (+ per-group settings) | GET / PATCH | read / write |
| `/api/stats` | GET | read |

Quick test:

```bash
curl http://localhost:3000/api/health
curl -H "X-API-Key: $KEY" http://localhost:3000/api/status
```

### How the EDBOTS App will talk to this API

The mobile/PWA app is a **pure control panel** — it never touches WhatsApp
session files or bot internals. It authenticates users with Appwrite
(`APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, server-side `APPWRITE_API_KEY`),
then calls this REST API with a per-user key:

```
EDBOTS App ──HTTPS──> EDBOTS REST API (/api/*) ──> running bot
     │                        │
     └── Appwrite auth        └── X-API-Key per user (scoped read/write)
```

- CORS is controlled by `EDBOTS_API_CORS_ORIGINS` (set it to your app's origin in production).
- Rate limiting (`EDBOTS_API_RATE_LIMIT`, `EDBOTS_API_RATE_WINDOW_MS`) protects the API from abuse.
- The API fails closed: no key configured → every authed route returns `401`.

---

## ✨ Features

- **Anti-ban architecture** — human-like delays, per-user rate limits, typing presence, spam/loop protection
- **100+ modular commands** — AI, business tools, fun/games, group management, media, utilities, text effects
- **AI engine** — Puter primary with multi-provider fallback (Groq, SambaNova, OpenRouter, HuggingFace)
- **Smart auto-reply** — keyword matching, learning, AI fallback
- **REST API control layer** — start/stop, settings, commands, auto-reply, AI, groups, statistics
- **CLI** — `edbots start`, `edbots pair`, `edbots doctor`, `edbots customize`, and more
- **Session safety** — atomic writes, integrity validation, self-repair

---

## 🛠️ Useful commands

```bash
npm start                # start bot + API
npm run api              # API only
npm run api:key          # create a per-user API key
npm run cli              # interactive CLI (start, customize, doctor…)
node temp/api-smoke.js   # API smoke tests (35 checks)
```

### CLI

```bash
edbots start       # start the bot (QR or pairing-code auth)
edbots pair        # pair via phone number
edbots status      # connection status
edbots stop        # stop the bot
edbots restart     # restart the bot
edbots doctor      # diagnose common problems
edbots customize   # interactive settings wizard
edbots update      # update to the latest version
```

---

## 🏗️ Architecture

```text
EDBOTS/
├── api/                       # REST API control layer (zero extra deps)
│   ├── server.js              # HTTP server, CORS, rate limiting
│   ├── core/                  # config, auth, router, validation, errors
│   ├── routes/                # health, status, bot, settings, commands…
│   └── createKey.js           # per-user API key generator
├── src/cli/                   # CLI (edbots …)
├── core/                      # engine, connection, handler, botState
├── commands/                  # 100+ command modules by category
├── utils/                     # anti-ban, AI engine, auto-reply, toggles…
├── data/                      # runtime data (git-ignored)
├── docs/API.md                # full API documentation
├── config.js                  # legacy bot config
└── index.js                   # entry point
```

The REST API is **purely additive**: the bot core (Baileys connection, message
handler, commands) runs exactly as before. If the API is disabled or crashes,
the bot keeps working.

---

## ⚖️ Disclaimer

EDBOTS is an independent automation framework. It is **not affiliated with WhatsApp or Meta**. Users are responsible for their usage — do not use for spam or unlawful activity.

## 📜 License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

**EDBOTS** • Intelligent Automation Engine • Built by Smart Tech Programming

</div>
