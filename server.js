const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ── Serve frontend ────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── TURN credentials endpoint ─────────────────────────────────────────
app.get('/api/turn-credentials', async (req, res) => {
  try {
    const response = await fetch(
      'https://airtalkk.metered.live/api/v1/turn/credentials?apiKey=14ZLQK-FdHnTkAB8yAq1YXKH-VT1Knacnk4qQYuML9rH1jkN'
    );
    const credentials = await response.json();
    res.json(credentials);
  } catch (err) {
    console.error('TURN fetch failed:', err);
    // Fallback to Google STUN if Metered is down
    res.json([
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]);
  }
});

// ── State ─────────────────────────────────────────────────────────────
const waitingQueue = [];
const activeRooms = {};
let onlineCount = 0;

const sampleProfiles = [
  { name: 'Anonymous', location: '🇫🇷 France', language: 'French / English' },
  { name: 'Anonymous', location: '🇧🇷 Brazil', language: 'Portuguese' },
  { name: 'Anonymous', location: '🇩🇪 Germany', language: 'German / English' },
  { name: 'Anonymous', location: '🇯🇵 Japan', language: 'Japanese' },
  { name: 'Anonymous', location: '🇺🇸 USA', language: 'English' },
  { name: 'Anonymous', location: '🇷🇴 Romania', language: 'Romanian / English' },
  { name: 'Anonymous', location: '🇮🇹 Italy', language: 'Italian' },
  { name: 'Anonymous', location: '🇷🇺 Russia', language: 'Russian' },
];
function randomProfile() {
  return sampleProfiles[Math.floor(Math.random() * sampleProfiles.length)];
}

// ── Socket.io ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId || socket.id;
  onlineCount++;
  io.emit('online-count', onlineCount);
  console.log(`[+] ${userId} connected (${onlineCount} online)`);

  socket.on('search-stranger', () => {
    removeFromQueue(userId);
    const waitingIdx = waitingQueue.findIndex(u => u.userId !== userId);
    if (waitingIdx !== -1) {
      const match = waitingQueue.splice(waitingIdx, 1)[0];
      const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      activeRooms[roomId] = { user1: userId, user2: match.userId, startTime: Date.now() };
      socket.join(roomId);
      match.socket.join(roomId);
      match.socket.emit('matched', { roomId, stranger: randomProfile() });
      socket.emit('matched', { roomId, stranger: randomProfile() });
      console.log(`[~] Matched ${userId} <-> ${match.userId} in ${roomId}`);
    } else {
      waitingQueue.push({ userId, socketId: socket.id, socket });
      socket.emit('waiting');
      console.log(`[~] ${userId} waiting (queue: ${waitingQueue.length})`);
    }
  });

  socket.on('cancel-search', () => { removeFromQueue(userId); });

  socket.on('offer', ({ roomId, offer }) => { socket.to(roomId).emit('offer', { roomId, offer }); });
  socket.on('answer', ({ roomId, answer }) => { socket.to(roomId).emit('answer', { answer }); });
  socket.on('ice-candidate', ({ roomId, candidate }) => { socket.to(roomId).emit('ice-candidate', { candidate }); });

  socket.on('end-call', (roomId) => {
    if (activeRooms[roomId]) delete activeRooms[roomId];
    socket.to(roomId).emit('call-ended');
    socket.leave(roomId);
  });

  socket.on('disconnect', () => {
    onlineCount = Math.max(0, onlineCount - 1);
    io.emit('online-count', onlineCount);
    removeFromQueue(userId);
    for (const [roomId, room] of Object.entries(activeRooms)) {
      if (room.user1 === userId || room.user2 === userId) {
        socket.to(roomId).emit('call-ended');
        delete activeRooms[roomId];
      }
    }
    console.log(`[-] ${userId} disconnected (${onlineCount} online)`);
  });

  function removeFromQueue(uid) {
    const idx = waitingQueue.findIndex(u => u.userId === uid);
    if (idx !== -1) waitingQueue.splice(idx, 1);
  }
});

// ── Start ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎙️  voice.link server running on port ${PORT}`);
  console.log(`   Open: http://localhost:${PORT}\n`);
});
