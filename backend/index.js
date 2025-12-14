const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { setupSignaling } = require('./ws/signaling');
const sessionManager = require('./sessions/sessionManager');

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Socket.IO setup
const io = new Server(server, {
  cors: corsOptions
});

// Setup signaling handlers
setupSignaling(io);

// REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/create-session', (req, res) => {
  try {
    const code = sessionManager.createSession();
    res.json({ code });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.get('/api/session/:code', (req, res) => {
  const session = sessionManager.getSession(req.params.code);
  if (session) {
    res.json({ 
      exists: true, 
      hasReceiver: !!session.receiverSocket,
      fileMeta: session.fileMeta || null
    });
  } else {
    res.json({ exists: false });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

// Cleanup expired sessions periodically
setInterval(() => {
  sessionManager.cleanupExpiredSessions();
}, 60000); // Every minute
