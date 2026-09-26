# EDBOTS REST API — Complete Reference

**Version 1.0.0** · Base path `/api` · Zero-dependency HTTP layer built into the bot process

This document is the full, code-verified contract for the EDBOTS REST API and its
Web Pairing surface. It is written for building the **external EDBOTS App**
(mobile or PWA) in a separate repository: everything here is stable, every
endpoint is documented with its real response shape, and every field is checked
against the implementation in `api/`.

> **Architecture guarantee:** the API is a purely additive control layer. It runs
> inside the bot process but never touches message handling. If the API is
> disabled or crashes, the bot keeps running exactly as before.

---

## Table of contents

1. [Getting started](#1-getting-started)
2. [Authentication](#2-authentication)
3. [Configuration (server side)](#3-configuration-server-side)
4. [Conventions](#4-conventions)
5. [Errors](#5-errors)
6. [Rate limiting](#6-rate-limiting)
7. [Endpoint reference](#7-endpoint-reference)
   - 7.1 [Discovery & health](#71-discovery--health)
   - 7.2 [Bot status & lifecycle](#72-bot-status--lifecycle)
   - 7.3 [Bot settings](#73-bot-settings)
   - 7.4 [Commands](#74-commands)
   - 7.5 [Auto-reply](#75-auto-reply)
   - 7.6 [AI settings](#76-ai-settings)
   - 7.7 [Groups](#77-groups)
   - 7.8 [Statistics](#78-statistics)
8. [Web pairing & live events (SSE)](#8-web-pairing--live-events-sse)
9. [Client integration guide](#9-client-integration-guide)
10. [TypeScript response types](#10-typescript-response-types)
11. [Testing the API](#11-testing-the-api)
12. [Stability & versioning](#12-stability--versioning)

---

## 1. Getting started

### Base URL

```
http://<host>:<port>/api
```

- Local development: `http://localhost:3000/api`
- The port follows `EDBOTS_API_PORT`, then `PORT`, then `3000`.
- The API starts **automatically with the bot** (`node index.js`, `npm start`,
  or the CLI). It can also run standalone without the bot: `npm run api`.

### First request

```bash
curl http://localhost:3000/api/health
```

```json
{
  "ok": true,
  "service": "EDBOTS API",
  "version": "1.0.0",
  "botVersion": "2.0.4",
  "uptimeSec": 42,
  "timestamp": "2026-09-23T12:00:00.000Z",
  "host": { "node": "v20.11.0", "platform": "Linux x64" }
}
```

`GET /api/health` is the only endpoint that needs no key.

### 30-second quickstart

```bash
# On the server: set a master key (or create per-user keys — see §2)
export EDBOTS_API_KEY="choose-a-long-random-string"

# From your app: read bot status
curl -H "X-API-Key: choose-a-long-random-string" http://your-server:3000/api/status
```

---

## 2. Authentication

Every endpoint except `GET /api/health` requires an API key. Send it either way:

```
X-API-Key: <your-key>
Authorization: Bearer <your-key>
```

Both headers work on every endpoint. The `Content-Type: application/json`
header is required for requests with a JSON body (`PATCH`, `POST` with fields).

### Key types

| Type | Source | Scopes |
|------|--------|--------|
| Master key | `EDBOTS_API_KEY` env var on the server | `read`, `write`, `admin` (everything) |
| Per-user key | Created on the server via `api/createKey.js` | Whatever you grant (`read`, `write`) |

### Creating a per-user key (on the server)

```bash
node api/createKey.js "2348012345678" read,write
```

Output (plaintext shown **once**, never stored):

```
API key created.
  keyId : key_a1b2c3d4
  owner : 2348012345678
  scopes: read,write

COPY THIS KEY NOW — it is NOT stored anywhere:

  edb_9f2c…
```

### How keys are stored & checked

- Per-user keys live in `data/apiKeys.json` **only as SHA-256 hashes**
  (the file is gitignored; a leak of the file exposes nothing).
- Every request is compared in **constant time** (timing-safe).
- `owner` and `keyId` are attached to the request context server-side.

### Key states → HTTP results

| Situation | Result |
|-----------|--------|
| No key sent | `401 UNAUTHORIZED` |
| Unknown key / wrong key | `401 UNAUTHORIZED` |
| Key revoked (`"revoked": true` in `data/apiKeys.json`) | `401 UNAUTHORIZED` |
| Valid key, missing scope (e.g. `read`-only key calls a write route) | `403 FORBIDDEN` |
| No keys configured at all on the server | Every authed route returns `401` (fail-closed) |

### Scope map

| Scope | Can do |
|-------|--------|
| `read` | All `GET` endpoints |
| `write` | All `POST` / `PATCH` / `DELETE` endpoints |
| `admin` | Everything (master key has this implicitly) |

### Revoking a key (on the server)

Edit `data/apiKeys.json`, set the entry's `"revoked": true`, save. Effect is
immediate (the file is re-read automatically on change).

---

## 3. Configuration (server side)

All API behavior is controlled by environment variables on the **server** —
your app never needs to know most of these, but the two you will care about
for a browser/PWA client are `EDBOTS_API_CORS_ORIGINS` and the port.

| Variable | Default | Purpose |
|----------|---------|---------|
| `EDBOTS_API_KEY` | *(empty)* | Master key. Leave empty to use only per-user keys. |
| `EDBOTS_API_ENABLED` | `true` | Set `false` to run the bot with no API at all. |
| `EDBOTS_API_PORT` | `PORT` or `3000` | API port. |
| `EDBOTS_API_HOST` | `0.0.0.0` | Bind address (`127.0.0.1` for local-only). |
| `EDBOTS_API_CORS_ORIGINS` | `*` | Comma-separated allowed browser origins, e.g. `https://app.edbots.com,https://www.edbots.com`. **Set this to your app's real origin in production.** |
| `EDBOTS_API_RATE_LIMIT` | `120` | Max requests per key/IP per window. |
| `EDBOTS_API_RATE_WINDOW_MS` | `60000` | Rate limit window (ms). |
| `EDBOTS_API_MAX_BODY` | `1048576` | Max JSON body size in bytes (1 MB). |

Secrets (WhatsApp session files, credentials, AI provider keys) are **never**
returned by any endpoint.

---

## 4. Conventions

### Response envelope

Every JSON response is one of:

```json
{ "ok": true, ...payload }
```

```json
{ "ok": false, "error": { "code": "MACHINE_CODE", "message": "human-readable", "details": [ ... ] } }
```

`details` is present only on `VALIDATION_ERROR` responses.

### Timestamps

All timestamps are ISO 8601 UTC strings, e.g. `2026-09-23T12:00:00.000Z`.

### JIDs and IDs

- Group JIDs look like `123456789012345678@g.us`
- User chat IDs look like `2348012345678@s.whatsapp.net`
- Where a JID is required, the API validates the format and rejects others
  with `400 VALIDATION_ERROR`.

### Validation

- Unknown request fields are **rejected** with `400` (strict surface).
- Empty/missing JSON bodies are treated as `{}` — endpoints with all-optional
  fields accept a body-less `POST`/`PATCH`.
- A JSON body must be an **object** (arrays, strings, numbers → `400`).
- Invalid JSON → `400 INVALID_JSON`.
- Body larger than `EDBOTS_API_MAX_BODY` → `413 PAYLOAD_TOO_LARGE`.

### HTTP methods

Only `GET`, `POST`, `PATCH`, `DELETE` are used. A known path with the wrong
method → `405 METHOD_NOT_ALLOWED`. An unknown path → `404 NOT_FOUND`.

---

## 5. Errors

### Error codes (stable, machine-readable)

| HTTP | `error.code` | When |
|------|--------------|------|
| 400 | `VALIDATION_ERROR` | Body/param failed validation; `details[]` lists each field problem |
| 400 | `INVALID_JSON` | Body is not parseable JSON |
| 401 | `UNAUTHORIZED` | Missing, invalid, or revoked key |
| 403 | `FORBIDDEN` | Valid key lacking the required scope |
| 404 | `NOT_FOUND` | Unknown path or unknown command/keyword resource |
| 405 | `METHOD_NOT_ALLOWED` | Path exists but not for this method |
| 409 | `CONFLICT` | Reserved (e.g. pairing while already connected — see §8) |
| 413 | `PAYLOAD_TOO_LARGE` | Body exceeded the configured maximum |
| 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded; includes `Retry-After` header (seconds) |
| 500 | `INTERNAL_ERROR` | Unexpected server error (details logged server-side only) |
| 503 | `SERVICE_UNAVAILABLE` | Underlying store/socket operation failed (e.g. listing groups while the connection dropped) |

### Validation error example

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "botName", "message": "'botName' must be a string" },
      { "field": "evilField", "message": "'evilField' is not an accepted field" }
    ]
  }
}
```

### 429 example

```
HTTP/1.1 429 Too Many Requests
Retry-After: 37
```

```json
{ "ok": false, "error": { "code": "TOO_MANY_REQUESTS", "message": "Rate limit exceeded. Slow down." } }
```

---

## 6. Rate limiting

- **Limit:** 120 requests per 60 s window by default, per client.
- **Client identity:** the `X-API-Key` header value when present, otherwise
  the client IP.
- Applies to all `/api` routes (including `GET /api/health`).
- Exceeding it returns `429` with a `Retry-After` header (seconds until the
  window resets).

**Client best practice:** poll at sane intervals (≥ 5 s for status), back off
on `429` using `Retry-After`, and never hammer write endpoints.

---

## 7. Endpoint reference

Complete endpoint list (also returned live by `GET /api`):

```
GET  /api/health
GET  /api/status
POST /api/bot/start
POST /api/bot/stop
GET  /api/settings
PATCH /api/settings
GET  /api/commands
POST /api/commands/{name}/enable
POST /api/commands/{name}/disable
GET  /api/commands/group/{groupId}
POST /api/commands/group/{groupId}/enable
POST /api/commands/group/{groupId}/disable
GET  /api/autoreply
PATCH /api/autoreply
GET  /api/autoreply/chat/{chatId}
PATCH /api/autoreply/chat/{chatId}
POST /api/autoreply/chat/{chatId}/keywords
DELETE /api/autoreply/chat/{chatId}/keywords/{keyword}
GET  /api/ai
PATCH /api/ai
GET  /api/groups
GET  /api/groups/{groupId}/settings
PATCH /api/groups/{groupId}/settings
GET  /api/stats
```

### 7.1 Discovery & health

#### `GET /api` — API index (no auth)

Returns service metadata and the live endpoint list.

```json
{
  "ok": true,
  "service": "EDBOTS API",
  "version": "1.0.0",
  "endpoints": [ "GET /api/health", "GET /pair (web pairing UI)", "..." ]
}
```

#### `GET /api/health` — public liveness probe (no auth)

```json
{
  "ok": true,
  "service": "EDBOTS API",
  "version": "1.0.0",
  "botVersion": "2.0.4",
  "uptimeSec": 3600,
  "timestamp": "2026-09-23T12:00:00.000Z",
  "host": { "node": "v20.11.0", "platform": "Linux x64" }
}
```

Use this for uptime monitoring. `botVersion` is the bot's package version
(may be `null` if unavailable).

---

### 7.2 Bot status & lifecycle

#### `GET /api/status` — auth: `read`

```json
{
  "ok": true,
  "bot": {
    "online": true,
    "status": "online",
    "user": { "id": "2348076435148:1@s.whatsapp.net", "name": "EDBots" },
    "startedAt": "2026-09-23T09:00:00.000Z",
    "lastConnectedAt": "2026-09-23T09:00:05.000Z",
    "lastDisconnectedAt": null,
    "lastDisconnectReason": null
  },
  "timestamp": "2026-09-23T12:00:00.000Z"
}
```

- `status` ∈ `offline | connecting | online`; `online` is the boolean form.
- `user` is `{ id, name }` when connected, otherwise `null`. Never credentials.
- `lastDisconnectReason` is a short reason string such as
  `connection_closed`, `timed_out`, `connection_replaced`,
  `restart_required`, `logged_out`, or `stopped_by_api`.

**App pattern:** poll this every 5–10 s for a status screen; combine with
`GET /api/health` for server liveness.

#### `POST /api/bot/stop` — auth: `write`

Stops the bot gracefully. The WhatsApp session is **preserved**; the bot will
not reconnect until started again.

```bash
curl -X POST -H "X-API-Key: $KEY" http://localhost:3000/api/bot/stop
```

```json
{
  "ok": true,
  "action": "stop",
  "previousStatus": "online",
  "status": "offline",
  "message": "Bot stopped. The WhatsApp session was preserved."
}
```

Stopping an already-stopped bot succeeds and is idempotent.

#### `POST /api/bot/start` — auth: `write`

Reconnects **inside the same process** using the stored session (no re-pairing
unless the session was logged out). Connection is asynchronous, so the response
is `202` and reflects the immediate status.

```json
{
  "ok": true,
  "action": "start",
  "status": "connecting",
  "message": "Start requested. Poll GET /api/status for the connection result."
}
```

- Starting an already-online bot returns `200` with
  `message: "Bot is already online."`
- **App pattern:** call start, then poll `GET /api/status` until
  `status === "online"` (typical: 3–10 s) or show the pairing flow if the
  session is gone (see §8.6).

---

### 7.3 Bot settings

#### `GET /api/settings` — auth: `read`

```json
{
  "ok": true,
  "settings": {
    "botName": "EDBots",
    "description": "Advanced WhatsApp AI Bot powered by EDBOTS Framework",
    "prefix": ".",
    "timezone": "Africa/Lagos",
    "selfMode": false,
    "autoRead": false,
    "autoTyping": false,
    "autoBio": false,
    "autoSticker": false,
    "autoReact": false,
    "autoDownload": false,
    "autoReply": false
  }
}
```

#### `PATCH /api/settings` — auth: `write`

All fields optional; only the fields you send change. Persisted across
restarts; behavior flags take effect on the running bot immediately.

| Field | Type | Constraints |
|-------|------|-------------|
| `botName` | string | ≤ 50 chars |
| `description` | string | ≤ 200 chars |
| `prefix` | string | ≤ 3 chars |
| `timezone` | string | ≤ 50 chars |
| `selfMode` | boolean | — |
| `autoRead` | boolean | — |
| `autoTyping` | boolean | — |
| `autoBio` | boolean | — |
| `autoSticker` | boolean | — |
| `autoReact` | boolean | — |
| `autoDownload` | boolean | — |
| `autoReply` | boolean | same as `PATCH /api/autoreply { enabled }` |

```bash
curl -X PATCH -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"botName":"My Bot","autoReply":true}' \
  http://localhost:3000/api/settings
```

Response: the full updated settings object (same shape as `GET`).

Notes:

- `prefix` is read per message, so it applies instantly.
- Cosmetic identity values (botName/description) are stored instantly; some
  are picked up by the running handler where safe, fully after a restart.
- `autoBio` and other behaviors map to the bot's existing feature toggles.

---

### 7.4 Commands

The bot has ~179 commands. The API exposes the canonical list with aliases
collapsed (each command appears once under its canonical name).

#### `GET /api/commands` — auth: `read`

```json
{
  "ok": true,
  "count": 179,
  "commands": [
    {
      "name": "ping",
      "description": "Check bot responsiveness",
      "category": "general",
      "aliases": ["pong"],
      "ownerOnly": false,
      "adminOnly": false,
      "groupOnly": false,
      "visibility": "public",
      "enabled": true
    }
  ]
}
```

`enabled` reflects the **global** toggle. Fields `ownerOnly` / `adminOnly` /
`groupOnly` describe the command's own permission model inside WhatsApp.

#### `POST /api/commands/{name}/disable` — auth: `write`

Globally disables a command. `{name}` accepts the canonical name **or any
alias** (case-insensitive).

```bash
curl -X POST -H "X-API-Key: $KEY" http://localhost:3000/api/commands/tagall/disable
```

```json
{ "ok": true, "command": "tagall", "enabled": false, "changed": true }
```

`changed: false` means it was already in that state (the call still succeeds).

#### `POST /api/commands/{name}/enable` — auth: `write`

```json
{ "ok": true, "command": "tagall", "enabled": true, "changed": true }
```

Unknown command → `404 NOT_FOUND` with
`message: "Unknown command 'xyz'"`.

#### Per-group command state

Each WhatsApp group can have its own disabled-command list (on top of the
global one).

| Endpoint | Auth | Body |
|----------|------|------|
| `GET /api/commands/group/{groupId}` | `read` | — |
| `POST /api/commands/group/{groupId}/enable` | `write` | `{"command":"ping"}` |
| `POST /api/commands/group/{groupId}/disable` | `write` | `{"command":"ping"}` |

`GET` response:

```json
{
  "ok": true,
  "groupId": "123456789012345678@g.us",
  "commands": [ { "name": "ping", "enabled": true }, { "name": "tagall", "enabled": false } ]
}
```

`groupId` must be a group JID; anything else → `400 VALIDATION_ERROR`.

---

### 7.5 Auto-reply

Auto-reply is keyword-based per chat, with an optional AI fallback, plus one
global master switch. Backed by the same store the running bot uses, so
changes are instant.

#### `GET /api/autoreply` — auth: `read`

```json
{
  "ok": true,
  "globalEnabled": true,
  "chats": [
    {
      "chatId": "2348012345678@s.whatsapp.net",
      "enabled": true,
      "fallbackToAI": true,
      "keywordCount": 2,
      "learnedCount": 5,
      "totalReplies": 41,
      "lastReplyTime": "2026-09-23T11:55:00.000Z"
    }
  ]
}
```

#### `PATCH /api/autoreply` — auth: `write`

Body: `{ "enabled": true }` (required boolean). The global switch is instant
and persistent.

```json
{ "ok": true, "globalEnabled": true, "message": "Auto-reply enabled." }
```

#### `GET /api/autoreply/chat/{chatId}` — auth: `read`

Chat with no config yet:

```json
{
  "ok": true,
  "chatId": "2348012345678@s.whatsapp.net",
  "exists": false,
  "note": "No auto-reply config yet. PATCH to initialize.",
  "config": null
}
```

Chat with config: `{ "ok": true, "chatId": "...", "exists": true, "config": { ...same shape as list item above... } }`

#### `PATCH /api/autoreply/chat/{chatId}` — auth: `write`

Body: `{ "enabled": true }` (required) + optional `"fallbackToAI": true`.
Initializing a chat that has no config creates it.

#### `POST /api/autoreply/chat/{chatId}/keywords` — auth: `write`

Add a keyword rule.

| Field | Type | Constraints | Default |
|-------|------|-------------|---------|
| `keyword` | string | required, ≤ 100 chars, non-empty | — |
| `response` | string | required, ≤ 2000 chars | — |
| `caseSensitive` | boolean | optional | `true` |

```bash
curl -X POST -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"keyword":"price","response":"Our plans start at $5/mo.","caseSensitive":false}' \
  http://localhost:3000/api/autoreply/chat/2348012345678@s.whatsapp.net/keywords
```

Response `201 Created`:

```json
{
  "ok": true,
  "chatId": "2348012345678@s.whatsapp.net",
  "keyword": "price",
  "response": "Our plans start at $5/mo.",
  "caseSensitive": false,
  "config": { "enabled": true, "fallbackToAI": true, "keywordCount": 3 }
}
```

#### `DELETE /api/autoreply/chat/{chatId}/keywords/{keyword}` — auth: `write`

```json
{ "ok": true, "chatId": "2348012345678@s.whatsapp.net", "keyword": "price", "removed": true, "config": { ... } }
```

- Unknown chat → `404` (`"No auto-reply config for this chat"`).
- Unknown keyword → `404` (`"Keyword 'x' not found for this chat"`).

---

### 7.6 AI settings

#### `GET /api/ai` — auth: `read`

```json
{ "ok": true, "ai": { "enabled": true, "personality": "friendly" } }
```

#### `PATCH /api/ai` — auth: `write`

Both fields optional:

- `enabled: boolean` — instantly stops/starts AI handling (`ai:` commands and
  AI fallback replies) on the running bot.
- `personality: string` — one of `friendly | professional | funny | concise | custom`.
  Any other value → `400`.

```bash
curl -X PATCH -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"enabled":true,"personality":"professional"}' \
  http://localhost:3000/api/ai
```

Response: the updated `{ ok: true, ai: { enabled, personality } }`.

AI provider keys are **never** exposed through this API.

---

### 7.7 Groups

#### `GET /api/groups` — auth: `read`

Lists the WhatsApp groups the bot currently participates in. Requires a live
connection: when the bot is offline it returns `200` with `online: false` and
an empty list (handle this in your UI rather than treating it as an error).

```json
{
  "ok": true,
  "online": true,
  "count": 1,
  "groups": [
    { "id": "123456789012345678@g.us", "name": "Dev Team", "size": 42, "isBotAdmin": true }
  ]
}
```

If the connection drops mid-request → `503 SERVICE_UNAVAILABLE`.

#### `GET /api/groups/{groupId}/settings` — auth: `read`

Returns the full moderation settings object for one group — the same store
the bot's group commands read. Works even while offline.

```json
{
  "ok": true,
  "groupId": "123456789012345678@g.us",
  "settings": {
    "antilink": false, "antilinkAction": "delete",
    "antitag": false, "antitagAction": "delete",
    "antiall": false, "antiviewonce": false, "antibot": false,
    "anticall": false, "antigroupmention": false, "antigroupmentionAction": "delete",
    "welcome": true, "welcomeMessage": "...", "goodbye": false, "goodbyeMessage": "...",
    "antiSpam": false, "antidelete": false, "nsfw": false, "detect": false,
    "chatbot": false, "autosticker": false
  }
}
```

#### `PATCH /api/groups/{groupId}/settings` — auth: `write`

Send only the fields you want to change.

Boolean fields (all optional):
`antilink, antitag, antiall, antiviewonce, antibot, anticall, antigroupmention,
welcome, goodbye, antiSpam, antidelete, nsfw, detect, chatbot, autosticker`

Action fields (strings, optional): `antilinkAction`, `antitagAction`,
`antigroupmentionAction` — each must be `delete | kick | warn`.

```bash
curl -X PATCH -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"antilink":true,"antilinkAction":"delete","welcome":true}' \
  http://localhost:3000/api/groups/123456789012345678@g.us/settings
```

Response: `{ "ok": true, "groupId": "...", "settings": { ...full object... } }`.

- Invalid JID → `400`. No recognized fields in body → `400`.
- Persistence failure → `503`.

---

### 7.8 Statistics

#### `GET /api/stats` — auth: `read`

Aggregated counters only — no message content, no JIDs of users, no credentials.

```json
{
  "ok": true,
  "bot": {
    "status": "online",
    "online": true,
    "uptimeHuman": "3h 12m",
    "uptimeSec": 11520,
    "startedAt": "2026-09-23T09:00:00.000Z",
    "lastConnectedAt": "2026-09-23T09:00:05.000Z"
  },
  "commands": { "disabledGlobally": 1 },
  "groups": { "known": 7, "activeToday": 3, "totalMessagesTracked": 15230 },
  "users": { "known": 214, "banned": 1 },
  "autoReply": { "chats": 2 },
  "system": { "node": "v20.11.0", "platform": "Linux x64", "memoryRssMb": 187, "loadAvg1m": 0.4 },
  "timestamp": "2026-09-23T12:00:00.000Z"
}
```

---

## 8. Web pairing & live events (SSE)

The **web pairing surface** is a separate, top-level HTTP surface (not under
`/api`) that owns first-time WhatsApp authentication. Your app can either link
the user to the built-in page or drive pairing programmatically using these
endpoints.

### 8.1 Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/pair` | `GET` | Built-in pairing page (HTML) |
| `/pair/status` | `GET` | Auth state + QR image + pairing code snapshot |
| `/pair/events` | `GET` | Server-Sent Events stream of all auth events |
| `/pair/request-code` | `POST` | Request a phone-number pairing code |
| `/pair/reset` | `POST` | Reset pairing state (retry after failure/logout) |

### 8.2 Authentication model (different from `/api`)

- Everything sensitive is gated by a **pairing token**, not an API key.
- The token is generated on server boot (while auth is pending) and printed to
  the **server console only** — the bot owner pastes it once.
- A valid token (via `?token=...` query param or `X-Pairing-Token` header)
  is exchanged for an **HttpOnly session cookie** valid for 12 h. The cookie
  is what makes EventSource work (it cannot send headers).
- Without a valid token/cookie: `401` with
  `error.code = "PAIRING_TOKEN_REQUIRED"`.
- The token is single-purpose: it is consumed automatically after successful
  connection, and expires after 24 h.
- No WhatsApp credentials, session keys, or raw QR strings ever cross the
  wire — the QR is a rendered PNG data-URL and the pairing code is the
  short-lived display code only.

### 8.3 `GET /pair/status` — token required

```json
{
  "ok": true,
  "auth": {
    "state": "QR_READY",
    "qrImage": "data:image/png;base64,...",
    "qrUpdatedAt": "2026-09-23T12:00:10.000Z",
    "pairingCode": null,
    "pairingCodeExpiresAt": null,
    "failureReason": null
  },
  "bot": { "status": "connecting", "online": false, "user": null },
  "publicUrl": "https://my-bot.example.com",
  "timestamp": "2026-09-23T12:00:12.000Z"
}
```

`qrImage` is a PNG data-URL you can drop straight into an `<img src>`.

### 8.4 `GET /pair/events` — SSE stream (token required)

`Content-Type: text/event-stream`. Each frame is `data: {JSON}\n\n`. The first
frame is always a `snapshot`; then live events follow. Comment keep-alives
(`: ping`) are sent every ~25 s.

Frame types:

```json
{ "type": "snapshot", "state": "WAITING_FOR_AUTH", "qrImage": null, "qrUpdatedAt": null, "pairingCode": null, "pairingCodeExpiresAt": null, "failureReason": null, "timestamp": "..." }
```

```json
{ "type": "state", "state": "CONNECTED", "reason": null, "timestamp": "..." }
```

```json
{ "type": "qr", "state": "QR_READY", "qrImage": "data:image/png;base64,...", "timestamp": "..." }
```

```json
{ "type": "pairing_code", "state": "PAIRING_CODE_REQUESTED", "code": "ABCD-EFGH", "expiresAt": "2026-09-23T12:02:00.000Z", "timestamp": "..." }
```

### 8.5 Auth state machine

| State | Meaning | Show in UI |
|-------|---------|------------|
| `INITIALIZING` | Process/socket starting | Spinner |
| `WAITING_FOR_AUTH` | Ready for QR or pairing code | Tabs: QR / phone number |
| `QR_READY` | QR available (`qrImage` set) | QR image + scan instructions |
| `PAIRING_CODE_REQUESTED` | Code issued (`pairingCode`, `pairingCodeExpiresAt`) | Big code + countdown (~2 min) |
| `CONNECTING` | Credentials received; linking in progress | Spinner |
| `CONNECTED` | WhatsApp linked and online | Success; stream ends client-side |
| `FAILED` | Attempt failed (`failureReason` set, e.g. `pairing_code_failed`) | Error + retry button |
| `LOGGED_OUT` | Session was rejected/logged out; re-pair needed | Error + "link again" |

Typical transitions: `INITIALIZING → WAITING_FOR_AUTH → QR_READY → CONNECTING → CONNECTED`.
On failure: any state → `FAILED` (retry via `/pair/reset`) or `LOGGED_OUT`.

### 8.6 `POST /pair/request-code` — token required

Body: `{ "phoneNumber": "2348012345678" }` (digits, 8–15, **including**
country code).

```json
{ "ok": true, "message": "Pairing code requested. The code will appear here in a few seconds.", "timestamp": "..." }
```

Returns `202`. The actual code **arrives via the SSE stream** (`pairing_code`
frame) a few seconds later — Baileys can only request it once the socket is
live and a QR has been issued. Error cases:

| Status | `error.code` | Cause |
|--------|--------------|-------|
| 400 | `INVALID_PHONE` | Not 8–15 digits |
| 401 | `PAIRING_TOKEN_REQUIRED` | Missing/expired token |
| 409 | `ALREADY_CONNECTED` | WhatsApp already linked |
| 429 | `TOO_MANY_REQUESTS` | > 20 pairing attempts/hour (per token/IP) |
| 503 | `SOCKET_NOT_READY` | Socket not up yet — retry in a few seconds |

### 8.7 `POST /pair/reset` — token required

Resets the pairing state machine to `WAITING_FOR_AUTH` (used after `FAILED`
or `LOGGED_OUT`). Response: `{ "ok": true, "message": "Pairing state reset." }`.

### 8.8 Driving first-time linking from your app

1. Owner opens your app's "Connect WhatsApp" screen.
2. Your app asks the owner for the pairing token (shown once in the server
   console at boot) and calls `GET /pair/status?token=<token>` — the response
   sets the session cookie for subsequent browser calls.
3. Open `GET /pair/events` and render states as they arrive (§8.5).
4. Either show the QR (`qr` frame) or collect a phone number and call
   `POST /pair/request-code`, then display the code from the `pairing_code`
   frame with its countdown.
5. On `state: "CONNECTED"`, close the stream and poll `GET /api/status` for
   `online: true` via the normal API.

> Mobile apps (no cookies): pass `X-Pairing-Token: <token>` (or `?token=`)
> on every `/pair/*` call instead of relying on the cookie. Native SSE via
> EventSource is browser-only; use a plain streaming HTTP client on mobile.

---

## 9. Client integration guide

### 9.1 A minimal typed client (works in browser and Node)

```js
class EdbotsClient {
  constructor(baseUrl, apiKey) {
    this.base = baseUrl.replace(/\/$/, '') + '/api';
    this.apiKey = apiKey;
  }

  async req(method, path, body) {
    const res = await fetch(this.base + path, {
      method,
      headers: {
        'X-API-Key': this.apiKey,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(json?.error?.message || `HTTP ${res.status}`);
      err.code = json?.error?.code;
      err.status = res.status;
      err.details = json?.error?.details;
      err.retryAfter = Number(res.headers.get('Retry-After')) || null;
      throw err;
    }
    return json;
  }

  // Convenience
  health()            { return this.req('GET', '/health'); }
  status()            { return this.req('GET', '/status'); }
  stats()             { return this.req('GET', '/stats'); }
  settings()          { return this.req('GET', '/settings'); }
  updateSettings(p)   { return this.req('PATCH', '/settings', p); }
  commands()          { return this.req('GET', '/commands'); }
  enableCommand(n)    { return this.req('POST', `/commands/${n}/enable`); }
  disableCommand(n)   { return this.req('POST', `/commands/${n}/disable`); }
  autoreply()         { return this.req('GET', '/autoreply'); }
  setAutoreply(on)    { return this.req('PATCH', '/autoreply', { enabled: on }); }
  addKeyword(chat, k) { return this.req('POST', `/autoreply/chat/${chat}/keywords`, k); }
  ai()                { return this.req('GET', '/ai'); }
  setAi(p)            { return this.req('PATCH', '/ai', p); }
  groups()            { return this.req('GET', '/groups'); }
  groupSettings(g)    { return this.req('GET', `/groups/${g}/settings`); }
  patchGroup(g, p)    { return this.req('PATCH', `/groups/${g}/settings`, p); }
  startBot()          { return this.req('POST', '/bot/start'); }
  stopBot()           { return this.req('POST', '/bot/stop'); }

  /** Wait until the bot is online (or timeout). */
  async waitOnline(timeoutMs = 30000, intervalMs = 3000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const s = await this.status();
      if (s.bot.status === 'online') return true;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
  }
}

// Usage
const bot = new EdbotsClient('https://my-bot.example.com', 'edb_...');
const st = await bot.status();
if (!st.bot.online) { await bot.startBot(); await bot.waitOnline(); }
```

### 9.2 Browser/PWA: CORS

- Set `EDBOTS_API_CORS_ORIGINS` on the server to your app origin(s):
  `EDBOTS_API_CORS_ORIGINS=https://app.yourdomain.com`
- Preflight (`OPTIONS`) is answered automatically with `204` and the proper
  `Access-Control-Allow-*` headers. Allowed headers:
  `Content-Type, X-API-Key, Authorization`.
- The default (`*`) is fine for development; lock it down in production.
- Native mobile apps are not affected by CORS at all.

### 9.3 Recommended UI flows

**Status screen** — `GET /api/health` (server up?) + `GET /api/status`
(bot online?) every 5–10 s; surface `lastDisconnectReason` as a human message.

**Start/stop with confidence** — `POST /api/bot/start` → poll status until
`online` (or show the pairing flow if it stays offline and the session was
logged out).

**Settings form** — render from `GET /api/settings`; on save, `PATCH` only the
changed fields; display server-returned values as source of truth.

**Commands manager** — `GET /api/commands`, group by `category`, global toggle
per command; per-group overrides in the group detail view.

**Group moderation** — pick group from `GET /api/groups` (handle
`online: false` gracefully), edit toggles via `PATCH /api/groups/{id}/settings`.

**Dashboard stats** — `GET /api/stats` on load and every 30–60 s.

### 9.4 Security checklist for the app

- [ ] Never ship the master key inside a browser/mobile bundle. Create a
      per-user `read,write` key and embed it only in server-side config or a
      secure store.
- [ ] Use HTTPS in front of the bot (reverse proxy or platform TLS).
- [ ] Lock `EDBOTS_API_CORS_ORIGINS` to your app origin.
- [ ] Treat the pairing token like a password: one-time paste, never logged.
- [ ] Expect `401` after key revocation and route the user to re-auth.
- [ ] Back off on `429` using `Retry-After`.

---

## 10. TypeScript response types

```ts
export type ApiOk<T> = { ok: true } & T;
export interface ApiError {
  ok: false;
  error: {
    code:
      | 'VALIDATION_ERROR' | 'INVALID_JSON' | 'UNAUTHORIZED' | 'FORBIDDEN'
      | 'NOT_FOUND' | 'METHOD_NOT_ALLOWED' | 'CONFLICT' | 'PAYLOAD_TOO_LARGE'
      | 'TOO_MANY_REQUESTS' | 'INTERNAL_ERROR' | 'SERVICE_UNAVAILABLE'
      | 'PAIRING_TOKEN_REQUIRED' | 'INVALID_PHONE' | 'ALREADY_CONNECTED'
      | 'SOCKET_NOT_READY';
    message: string;
    details?: { field?: string; message: string }[];
  };
}
export type ApiResponse<T> = ApiOk<T> | ApiError;

export interface Health {
  service: string; version: string; botVersion: string | null;
  uptimeSec: number; timestamp: string;
  host: { node: string; platform: string };
}

export type BotStatus = 'offline' | 'connecting' | 'online';
export interface BotStatusBody {
  bot: {
    online: boolean; status: BotStatus;
    user: { id: string; name: string | null } | null;
    startedAt: string; lastConnectedAt: string | null;
    lastDisconnectedAt: string | null; lastDisconnectReason: string | null;
  };
  timestamp: string;
}

export interface Settings {
  botName: string; description: string; prefix: string; timezone: string;
  selfMode: boolean; autoRead: boolean; autoTyping: boolean; autoBio: boolean;
  autoSticker: boolean; autoReact: boolean; autoDownload: boolean; autoReply: boolean;
}

export interface CommandInfo {
  name: string; description: string; category: string; aliases: string[];
  ownerOnly: boolean; adminOnly: boolean; groupOnly: boolean;
  visibility: string; enabled: boolean;
}

export interface AutoreplyChatStatus {
  enabled: boolean; fallbackToAI: boolean; keywordCount: number;
  learnedCount: number; totalReplies: number; lastReplyTime: string | null;
}

export interface AiSettings { enabled: boolean; personality: 'friendly' | 'professional' | 'funny' | 'concise' | 'custom'; }

export interface GroupSummary {
  id: string; name: string; size: number; isBotAdmin: boolean;
}

export interface GroupSettings {
  antilink: boolean; antilinkAction: 'delete' | 'kick' | 'warn';
  antitag: boolean; antitagAction: 'delete' | 'kick' | 'warn';
  antiall: boolean; antiviewonce: boolean; antibot: boolean; anticall: boolean;
  antigroupmention: boolean; antigroupmentionAction: 'delete' | 'kick' | 'warn';
  welcome: boolean; welcomeMessage: string;
  goodbye: boolean; goodbyeMessage: string;
  antiSpam: boolean; antidelete: boolean; nsfw: boolean; detect: boolean;
  chatbot: boolean; autosticker: boolean;
}

export interface StatsBody {
  bot: { status: BotStatus; online: boolean; uptimeHuman: string; uptimeSec: number;
         startedAt: string; lastConnectedAt: string | null };
  commands: { disabledGlobally: number };
  groups: { known: number; activeToday: number; totalMessagesTracked: number };
  users: { known: number; banned: number };
  autoReply: { chats: number };
  system: { node: string; platform: string; memoryRssMb: number; loadAvg1m: number };
  timestamp: string;
}

// ── Web pairing ─────────────────────────────────────────────────────────
export type AuthState =
  | 'INITIALIZING' | 'WAITING_FOR_AUTH' | 'QR_READY' | 'PAIRING_CODE_REQUESTED'
  | 'CONNECTING' | 'CONNECTED' | 'FAILED' | 'LOGGED_OUT';

export interface AuthSnapshot {
  state: AuthState;
  qrImage: string | null;           // PNG data-URL when state === 'QR_READY'
  qrUpdatedAt: string | null;
  pairingCode: string | null;       // "ABCD-EFGH" while valid
  pairingCodeExpiresAt: string | null;
  failureReason: string | null;
}

export interface PairStatusBody {
  ok: true;
  auth: AuthSnapshot;
  bot: { status: BotStatus; online: boolean; user: { id: string; name: string | null } | null };
  publicUrl: string | null;
  timestamp: string;
}

export type PairSseFrame =
  | ({ type: 'snapshot' } & AuthSnapshot & { timestamp: string })
  | ({ type: 'state'; state: AuthState; reason?: string; timestamp: string })
  | ({ type: 'qr'; state: 'QR_READY'; qrImage: string | null; timestamp: string })
  | ({ type: 'pairing_code'; state: 'PAIRING_CODE_REQUESTED'; code: string; expiresAt: string; timestamp: string });
```

---

## 11. Testing the API

### Automated smoke test (48 checks, no WhatsApp needed)

```bash
npm test
```

Boots the API in-process on port 3777 and exercises auth, validation, every
read/write route, CORS, rate limiting, 404/405 handling, and the web pairing
surface. Never calls `/api/bot/start` — safe to run anywhere.

### Manual smoke sequence

```bash
BASE=http://localhost:3000/api
KEY="your-key"

curl -s $BASE/health                                   # public
curl -s $BASE/status                                   # → 401 (no key)
curl -s -H "X-API-Key: wrong" $BASE/status             # → 401
curl -s -H "X-API-Key: $KEY" $BASE/status              # → 200
curl -s -H "X-API-Key: $KEY" $BASE/settings
curl -s -H "X-API-Key: $KEY" $BASE/commands
curl -s -H "X-API-Key: $KEY" $BASE/stats

curl -s -X PATCH -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"autoReply":true}' $BASE/settings               # write path
```

### CORS preflight check

```bash
curl -s -i -X OPTIONS http://localhost:3000/api/status \
  -H "Origin: https://app.example.com" \
  -H "Access-Control-Request-Method: PATCH"
# Expect: HTTP 204 + access-control-allow-origin: https://app.example.com
```

---

## 12. Stability & versioning

- The API version is reported by `GET /api/health` (`version: "1.0.0"`).
- **Stable contract:** the envelope (`ok`, `error.code`), all documented field
  names, status codes, and error codes above are treated as fixed.
- Additive evolution: new fields may appear in responses — ignore unknown
  fields in your client (do not fail on them).
- New endpoints may be added; existing ones will not be removed or reshaped
  within the same major version.
- The endpoint list is also self-describing at runtime via `GET /api`.

### Where the implementation lives (for reference)

| Area | File |
|------|------|
| Server, routing, CORS, rate limit | `api/server.js`, `api/core/*` |
| Auth & key hashing | `api/core/auth.js`, `api/createKey.js` |
| Route handlers | `api/routes/*.js` |
| Web pairing + SSE | `api/webpair/routes.js`, `core/authEvents.js` |
| Bot runtime state bridge | `core/botState.js` |
| Smoke tests | `tests/api-smoke.test.js` |
