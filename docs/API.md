# EDBOTS REST API

A secure control layer for the EDBOTS WhatsApp bot. A separate EDBOTS App
(mobile/PWA) uses this API to view bot status, start/stop the bot, and manage
settings, commands, auto-reply, AI, groups, and statistics.

> **Architecture note:** the API is purely additive. The bot core
> (Baileys connection, message handler, commands) is untouched except for
> tiny observational hooks. If the API is disabled or fails, the bot runs
> exactly as before.

---

## API base URL

```
http://<host>:<port>/api
```

- Local: `http://localhost:3000/api`
- The port follows `EDBOTS_API_PORT`, then `PORT`, then `3000`.

---

## Authentication

Every endpoint except `GET /api/health` requires an API key.

Send it either way:

```
X-API-Key: <your-key>
Authorization: Bearer <your-key>
```

Key types:

| Type | Where it comes from | Access |
|------|--------------------|--------|
| Master key | `EDBOTS_API_KEY` env var | Full (`read`, `write`, `admin`) |
| Per-user key | `node api/createKey.js <owner> [scopes]` | The scopes you grant |

Per-user keys are stored **only as SHA-256 hashes** in `data/apiKeys.json`
(gitignored). The plaintext key is shown once at creation and never stored.
Requests are compared in constant time. Missing/invalid/revoked keys → `401`.
A valid key without the required scope → `403`.

**Creating a user key:**

```bash
node api/createKey.js "2348012345678" read,write
# Copy the printed key now — it is not stored anywhere.
```

---

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `EDBOTS_API_KEY` | *(empty)* | Master API key. Leave empty to use only per-user keys. |
| `EDBOTS_API_ENABLED` | `true` | Set `false` to run the bot without the API. |
| `EDBOTS_API_PORT` | `PORT` or `3000` | API port. |
| `EDBOTS_API_HOST` | `0.0.0.0` | Bind address. Use `127.0.0.1` for local-only. |
| `EDBOTS_API_CORS_ORIGINS` | `*` | Comma-separated allowed browser origins. |
| `EDBOTS_API_RATE_LIMIT` | `120` | Max requests per key/IP per window. |
| `EDBOTS_API_RATE_WINDOW_MS` | `60000` | Rate limit window. |
| `EDBOTS_API_MAX_BODY` | `1048576` | Max JSON body size (bytes). |

Secrets (session files, WhatsApp credentials, AI provider keys) are **never**
exposed by any endpoint.

---

## Conventions

- All responses are JSON: `{ "ok": true, ... }` or
  `{ "ok": false, "error": { "code", "message", "details?" } }`.
- Error codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN`
  (403), `NOT_FOUND` (404), `METHOD_NOT_ALLOWED` (405), `CONFLICT` (409),
  `PAYLOAD_TOO_LARGE` (413), `TOO_MANY_REQUESTS` (429, includes `Retry-After`),
  `SERVICE_UNAVAILABLE` (503), `INTERNAL_ERROR` (500).
- Unknown request fields are rejected with 400.

---

## Endpoints

### Health

#### `GET /api/health` — public, no auth

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

---

### Status

#### `GET /api/status` — auth: `read`

```bash
curl -H "X-API-Key: $KEY" http://localhost:3000/api/status
```

```json
{
  "ok": true,
  "bot": {
    "online": false,
    "status": "offline",
    "user": null,
    "startedAt": "2026-09-23T12:00:00.000Z",
    "lastConnectedAt": null,
    "lastDisconnectedAt": "2026-09-23T12:01:00.000Z",
    "lastDisconnectReason": "connection_closed"
  }
}
```

`status` is `offline | connecting | online`. `user` contains only
`{ id, name }` when online — never credentials.

---

### Bot lifecycle

#### `POST /api/bot/stop` — auth: `write`

Stops the bot gracefully. The WhatsApp session is preserved; no reconnect.

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

#### `POST /api/bot/start` — auth: `write`

Reconnects within the same process using the existing engine.
Returns `202` because connecting is asynchronous.

```bash
curl -X POST -H "X-API-Key: $KEY" http://localhost:3000/api/bot/start
```

```json
{
  "ok": true,
  "action": "start",
  "status": "connecting",
  "message": "Start requested. Poll GET /api/status for the connection result."
}
```

---

### Bot settings

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

All fields optional; only sent fields change. Booleans: `selfMode`,
`autoRead`, `autoTyping`, `autoBio`, `autoSticker`, `autoReact`,
`autoDownload`, `autoReply`. Strings: `botName` (≤50), `description` (≤200),
`prefix` (≤3), `timezone` (≤50).

```bash
curl -X PATCH -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"botName":"My Bot","autoReply":true}' \
  http://localhost:3000/api/settings
```

Behavior flags take effect on the running bot immediately (no restart) and
persist across restarts. Identity strings (botName/prefix) apply to the
running handler where safe; the prefix is read per message so it also applies
immediately, while some cosmetic values apply after restart.

---

### Commands

#### `GET /api/commands` — auth: `read`

```json
{
  "ok": true,
  "count": 2,
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

#### `POST /api/commands/{name}/disable` — auth: `write`

Globally disables a command (owner is bypassed by the bot's own owner checks,
as before).

```bash
curl -X POST -H "X-API-Key: $KEY" http://localhost:3000/api/commands/tagall/disable
```

```json
{ "ok": true, "command": "tagall", "enabled": false, "changed": true }
```

`changed: false` means it was already in that state.

#### `POST /api/commands/{name}/enable` — auth: `write`

```json
{ "ok": true, "command": "tagall", "enabled": true, "changed": true }
```

#### Per-group command state

- `GET /api/commands/group/{groupId}` — auth: `read` — lists each command's
  enabled state in that group.
- `POST /api/commands/group/{groupId}/enable` — auth: `write` — body:
  `{"command":"ping"}`.
- `POST /api/commands/group/{groupId}/disable` — auth: `write` — body:
  `{"command":"ping"}`.

`groupId` is a WhatsApp group JID, e.g. `123456789012345678@g.us`.

---

### Auto-reply

#### `GET /api/autoreply` — auth: `read`

```json
{
  "ok": true,
  "globalEnabled": true,
  "chats": [
    { "chatId": "2348012345678@s.whatsapp.net", "enabled": true,
      "fallbackToAI": true, "keywordCount": 2, "learnedCount": 5,
      "totalReplies": 41, "lastReplyTime": "2026-09-23T11:55:00.000Z" }
  ]
}
```

#### `PATCH /api/autoreply` — auth: `write`

Body: `{"enabled": true}`. Instant + persistent.

#### `GET /api/autoreply/chat/{chatId}` — auth: `read`

Returns `exists: false` with a note when the chat has no config yet.

#### `PATCH /api/autoreply/chat/{chatId}` — auth: `write`

Body: `{"enabled": true, "fallbackToAI": true}` (fallbackToAI optional).

#### `POST /api/autoreply/chat/{chatId}/keywords` — auth: `write`

```bash
curl -X POST -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"keyword":"price","response":"Our plans start at $5/mo.","caseSensitive":false}' \
  http://localhost:3000/api/autoreply/chat/2348012345678@s.whatsapp.net/keywords
```

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

`caseSensitive` defaults to `true` (matching the bot's own behavior).

#### `DELETE /api/autoreply/chat/{chatId}/keywords/{keyword}` — auth: `write`

```json
{ "ok": true, "chatId": "2348012345678@s.whatsapp.net", "keyword": "price", "removed": true }
```

---

### AI settings

#### `GET /api/ai` — auth: `read`

```json
{ "ok": true, "ai": { "enabled": true, "personality": "friendly" } }
```

#### `PATCH /api/ai` — auth: `write`

Body (both optional): `{"enabled": true, "personality": "professional"}`.
`personality` ∈ `friendly | professional | funny | concise | custom`.

Disabling AI instantly stops `ai:` handling and AI fallback replies on the
running bot. Provider API keys are never returned.

---

### Groups

#### `GET /api/groups` — auth: `read`

Lists groups the bot participates in. When offline, returns `online: false`
and an empty list with a note.

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

#### `GET /api/groups/{groupId}/settings` — auth: `read`

Returns the full group settings object (antilink, welcome, goodbye, etc.) —
the same store the bot's group commands read.

#### `PATCH /api/groups/{groupId}/settings` — auth: `write`

Booleans (all optional): `antilink`, `antitag`, `antiall`, `antiviewonce`,
`antibot`, `anticall`, `antigroupmention`, `welcome`, `goodbye`, `antiSpam`,
`antidelete`, `nsfw`, `detect`, `chatbot`, `autosticker`.
Strings: `antilinkAction`, `antitagAction`, `antigroupmentionAction` ∈
`delete | kick | warn`.

```bash
curl -X PATCH -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"antilink":true,"antilinkAction":"delete","welcome":true}' \
  http://localhost:3000/api/groups/123456789012345678@g.us/settings
```

```json
{ "ok": true, "groupId": "123456789012345678@g.us", "settings": { "antilink": true } }
```

(Full settings object is returned; abbreviated here.)

---

### Statistics

#### `GET /api/stats` — auth: `read`

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
  "system": { "node": "v20.11.0", "platform": "Linux x64", "memoryRssMb": 187, "loadAvg1m": 0.4 }
}
```

No message content, JIDs, or credentials are included.

---

## Running & testing

### Run

The API starts automatically with the bot (both `node index.js` and
`edbots start`), unless `EDBOTS_API_ENABLED=false`.

Run the API standalone (no bot):

```bash
npm run api          # node api/server.js
```

### Configure

```bash
export EDBOTS_API_KEY="your-master-key"        # or create user keys:
node api/createKey.js "2348012345678" read,write
```

### Smoke test sequence

```bash
BASE=http://localhost:3000/api
KEY="your-key"

# 1. Public health (no auth)
curl -s $BASE/health

# 2. Auth works / fails closed
curl -s -H "X-API-Key: $KEY" $BASE/status
curl -s $BASE/status                 # → 401
curl -s -H "X-API-Key: wrong" $BASE/status   # → 401

# 3. Read endpoints
curl -s -H "X-API-Key: $KEY" $BASE/settings
curl -s -H "X-API-Key: $KEY" $BASE/commands
curl -s -H "X-API-Key: $KEY" $BASE/stats

# 4. Toggle something, then verify
curl -s -X PATCH -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"autoReply":true}' $BASE/settings
curl -s -H "X-API-Key: $KEY" $BASE/settings

# 5. Lifecycle (use a test instance!)
curl -s -X POST -H "X-API-Key: $KEY" $BASE/bot/stop
curl -s -H "X-API-Key: $KEY" $BASE/status
curl -s -X POST -H "X-API-Key: $KEY" $BASE/bot/start
```

### CORS preflight check

```bash
curl -s -i -X OPTIONS http://localhost:3000/api/status \
  -H "Origin: https://app.example.com" \
  -H "Access-Control-Request-Method: PATCH"
```

Expect `204` with `Access-Control-Allow-Origin` for allowed origins.

---

## Security summary

- API keys: constant-time compare, hashed-at-rest user keys, revocable via
  `data/apiKeys.json` (`"revoked": true`).
- Rate limited per key/IP; oversized bodies rejected; strict JSON validation.
- CORS restricted to configured origins (or `*` for development).
- Fails closed with 401 when no keys are configured.
- Zero exposure of WhatsApp session files, credentials, or AI provider keys.
- The bot keeps running even if the API layer crashes; API failures never
  affect message handling.
