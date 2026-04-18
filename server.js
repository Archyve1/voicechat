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

// ── State ─────────────────────────────────────────────────────────────
const waitingQueue = [];          // [{ userId, socketId, socket }]
const activeRooms = {};           // { roomId: { user1, user2, startTime } }
let onlineCount = 0;

// Sample stranger "profiles" (in prod, use real Telegram user data)
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

  // ── Search ──────────────────────────────────────────────────────────
  socket.on('search-stranger', () => {
    // Remove from queue if already there
    removeFromQueue(userId);

    const waitingIdx = waitingQueue.findIndex(u => u.userId !== userId);
    if (waitingIdx !== -1) {
      // Match found
      const match = waitingQueue.splice(waitingIdx, 1)[0];
      const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      activeRooms[roomId] = {
        user1: userId,
        user2: match.userId,
        startTime: Date.now()
      };

      // Join both to the room
      socket.join(roomId);
      match.socket.join(roomId);

      // Notify both with each other's "profile"
      match.socket.emit('matched', { roomId, stranger: randomProfile() });
      socket.emit('matched', { roomId, stranger: randomProfile() });

      console.log(`[~] Matched ${userId} <-> ${match.userId} in ${roomId}`);
    } else {
      // Add to queue
      waitingQueue.push({ userId, socketId: socket.id, socket });
      socket.emit('waiting');
      console.log(`[~] ${userId} added to queue (queue length: ${waitingQueue.length})`);
    }
  });

  // ── Cancel search ───────────────────────────────────────────────────
  socket.on('cancel-search', () => {
    removeFromQueue(userId);
    console.log(`[-] ${userId} cancelled search`);
  });

  // ── WebRTC signaling ────────────────────────────────────────────────
  socket.on('offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('offer', { roomId, offer });
  });

  socket.on('answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('answer', { answer });
  });

  socket.on('ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice-candidate', { candidate });
  });

  // ── End call ────────────────────────────────────────────────────────
  socket.on('end-call', (roomId) => {
    if (activeRooms[roomId]) {
      console.log(`[x] Room ${roomId} ended`);
      delete activeRooms[roomId];
    }
    socket.to(roomId).emit('call-ended');
    socket.leave(roomId);
  });

  // ── Disconnect ──────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    onlineCount = Math.max(0, onlineCount - 1);
    io.emit('online-count', onlineCount);
    removeFromQueue(userId);

    // End any active rooms this user was in
    for (const [roomId, room] of Object.entries(activeRooms)) {
      if (room.user1 === userId || room.user2 === userId) {
        socket.to(roomId).emit('call-ended');
        delete activeRooms[roomId];
        console.log(`[x] Room ${roomId} ended (user disconnected)`);
      }
    }

    console.log(`[-] ${userId} disconnected (${onlineCount} online)`);
  });

  // ── Helper ──────────────────────────────────────────────────────────
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

