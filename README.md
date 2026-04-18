# voice.link — Telegram Voice Chat

A Telegram Web App that lets strangers talk via voice. Tinder-style matchmaking, WebRTC audio, Socket.io signaling.

---

## Project Structure

```
voicechat/
├── public/
│   └── index.html     ← Telegram Web App UI (dark, minimal)
├── server.js          ← Node.js + Socket.io server
├── package.json
└── README.md
```

---

## Local Development

```bash
npm install
npm run dev
# open http://localhost:3000
```

> Note: Microphone access requires HTTPS in production. Locally it works over http://localhost.

---

## Deploy to Railway (recommended — free tier)

1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Railway auto-detects Node.js, sets `PORT` automatically
4. Your app gets a public HTTPS URL like `https://yourapp.up.railway.app`

---

## Set Up the Telegram Bot

### Step 1 — Create bot

```
1. Open Telegram → @BotFather
2. /newbot → give it a name and username
3. Copy the bot token
```

### Step 2 — Register the Web App URL

After deploying, run this once (replace TOKEN and URL):

```bash
curl -X POST "https://api.telegram.org/botYOUR_TOKEN/setMenuButton" \
  -H "Content-Type: application/json" \
  -d '{
    "menu_button": {
      "type": "web_app",
      "text": "Open Voice Chat",
      "web_app": { "url": "https://YOUR_RAILWAY_URL" }
    }
  }'
```

### Step 3 — Test

Open your bot in Telegram → tap the menu button → the voice chat UI opens as a Web App.

---

## How It Works

```
User A taps "Find Stranger"
  → emits search-stranger to Socket.io server

Server checks waiting queue
  → if someone waiting: creates room, notifies both → matched event
  → if nobody: adds to queue → waiting event

Both users receive "matched"
  → Initiator creates WebRTC offer → sends via socket
  → Responder receives offer, creates answer → sends back
  → ICE candidates exchanged → P2P audio connection established

Call audio flows directly peer-to-peer (no server relay)
```

---

## Customization

| What | Where |
|------|-------|
| Add real user profiles | Pass Telegram `initData` to server, store in Redis |
| Block/report system | Add `blocked` Set per userId, filter queue matches |
| Text chat alongside voice | Add a Socket.io `message` event + chat UI |
| Video support | Change `getUserMedia` to `{ audio: true, video: true }` |
| TURN server (for firewalled users) | Replace STUN in `iceServers` with a TURN server (coturn) |

---

## Production Checklist

- [ ] HTTPS domain (Railway/Vercel provides this automatically)
- [ ] Bot created and token saved
- [ ] Menu button registered with BotFather
- [ ] (Optional) Redis for persistent queue if scaling horizontally
- [ ] (Optional) TURN server for users behind symmetric NAT
