const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const config = require('./config/env');
const apiRoutes = require('./routes/api');
const { setupSocketIO } = require('./socket');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors(config.cors));
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

// Socket.IO setup
const io = new Server(server, {
    cors: config.cors
});

setupSocketIO(io);

module.exports = { app, server };
