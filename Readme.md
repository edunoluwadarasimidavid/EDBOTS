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

## 📱 Web Pairing on Headless Servers

On platforms without an interactive terminal (Render, Railway, Docker, VPS
under systemd, etc.), EDBOTS automatically starts a **web pairing interface**
at `/pair` instead of printing a QR code to a terminal you can't see. It
supports **both** QR-code and phone-number/pairing-code authentication, and
updates live in the browser.

Local machines with a real terminal keep the existing interactive flow —
nothing changes there.

### How it works

```
EDBOTS starts
   ├─ session found ──> connects silently (no pairing page needed)
   └─ no session
        ├─ interactive terminal ──> existing QR / pairing-code prompts
        └─ headless (no TTY, or config.js publicUrl set)
                 └─ prints the pairing URL + token, serves /pair
                    (the QR shows ONLY in the browser, never the terminal)
```

### Deploying (works on any host — zero URL configuration)

1. **Bind address/port**: EDBOTS respects `PORT` and binds `0.0.0.0` by
   default (override with `HOST` / `EDBOTS_PAIR_HOST`).
2. **Start the bot** (`node index.js` or your platform's start command).

The pairing URL is discovered automatically, in this order:

1. `webPairing.publicUrl` in **config.js** (only if you set it there)
2. The hosting platform's own injected variables — Render
   (`RENDER_EXTERNAL_URL`), Railway, Fly.io, Heroku, Koyeb, GitHub
   Codespaces, Gitpod, Vercel — detected with no configuration
3. **The first browser visit** — the exact domain you open is learned and
   printed to the console (works behind any proxy, tunnel, or custom domain)
4. LAN IP candidates (e.g. `http://192.168.1.20:3000/pair`) for VPS/home servers

On container hosts (Render, Docker, Kubernetes) the machine's own IP is
often an internal-only address (`172.x…`); EDBOTS labels such candidates
**“internal network only (container IP)”** and additionally looks up the
server's real public egress IP, printing it as:
`[AUTH] Server public IP: 51.x.x.x — …`.

The console prints something like:

```text
╭────────────────────────────────────────────╮
│        EDBOTS Web Authentication           │
╰────────────────────────────────────────────╯

  Open this URL in your browser:
  https://your-app.onrender.com/pair
  detected (RENDER_EXTERNAL_URL)

  Pairing token (paste into the browser when asked):
  9f2c7a…64-hex-characters…
```

3. **Open the URL** on your phone or laptop.
4. **Paste the pairing token** once (shown in the server console). This
   protects the pairing page from random visitors — it can trigger WhatsApp
   authentication, so it is gated. The browser remembers it for the session.
5. **Choose QR Code or Phone Number** and complete authentication in
   WhatsApp → Linked Devices. On a headless server the QR code appears only
   in the browser — it is never printed to the server terminal.
6. **Wait for the green ✓** — the session is saved and EDBOTS starts
   normally. On restart it reconnects automatically without pairing again.

> **Custom domain behind a proxy?** Set `webPairing.publicUrl` in
> `config.js`. Deployment settings belong there — `.env` is reserved for
> REST API / Appwrite server secrets.

### Render example

- **Build command:** `npm install`
- **Start command:** `node index.js`
- **Environment:** nothing extra — Render's `RENDER_EXTERNAL_URL` and `PORT`
  are picked up automatically (`OWNER_NUMBER` / `EDBOTS_API_KEY` as usual).

### Web pairing endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /pair` | public page | HTML interface (token required to see auth data) |
| `GET /pair/status` | pairing token | auth state snapshot (no credentials) |
| `GET /pair/events` | pairing token | live SSE stream: QR / code / state changes |
| `POST /pair/request-code` | pairing token + rate limit | request a pairing code |
| `POST /pair/reset` | pairing token | reset the pairing UI state |

Environment variables for web pairing:

| Setting | Default | Purpose |
|---|---|---|
| `webPairing.publicUrl` (config.js) | *(auto)* | Only needed for custom domains behind proxies |
| `HOST` env | `0.0.0.0` | Bind address |
| `PORT` env | `3000` | Bind port (injected by most platforms) |
| `EDBOTS_PAIR_HOST` env | — | Overrides bind host for the pairing server only |
| `EDBOTS_WEB_PAIRING_ENABLED` env | `true` | Set `false` to disable the `/pair` surface |
| `EDBOTS_PAIRING_TOKEN_TTL_MS` env | 24 h | Pairing-token lifetime |
| `EDBOTS_PAIR_MAX_REQUESTS` env | `20` | Max pairing-code requests/hour per token+IP |

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
npm test                 # API + web-pairing smoke tests (48 checks)
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
