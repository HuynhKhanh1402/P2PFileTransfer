require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://127.0.0.1:5173'],
        methods: ['GET', 'POST'],
        credentials: true
    },
    session: {
        timeout: parseInt(process.env.SESSION_TIMEOUT) || 30 * 60 * 1000,
        cleanupInterval: parseInt(process.env.SESSION_CLEANUP_INTERVAL) || 60000
    },
    stun: {
        servers: process.env.STUN_SERVERS?.split(',') || [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302'
        ]
    }
};
