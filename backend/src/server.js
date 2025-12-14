const { server } = require('./app');
const config = require('./config/env');
const sessionService = require('./services/sessionService');

// Start server
server.listen(config.port, () => {
    console.log(`Signaling server running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Health check: http://localhost:${config.port}/api/health`);
});

// Cleanup expired sessions periodically
setInterval(() => {
    sessionService.cleanupExpiredSessions();
}, config.session.cleanupInterval);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});
