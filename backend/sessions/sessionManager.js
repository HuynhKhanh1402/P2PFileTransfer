// In-memory session storage
const sessions = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

/**
 * Generate a random 6-digit code
 */
function generateCode() {
    let code;
    do {
        code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (sessions.has(code));
    return code;
}

/**
 * Create a new session and return the code
 */
function createSession() {
    const code = generateCode();
    sessions.set(code, {
        code,
        senderSocket: null,
        receiverSocket: null,
        fileMeta: null,
        createdAt: Date.now()
    });
    console.log(`Session created: ${code}`);
    return code;
}

/**
 * Get a session by code
 */
function getSession(code) {
    return sessions.get(code);
}

/**
 * Set sender socket for a session
 */
function setSenderSocket(code, socket) {
    const session = sessions.get(code);
    if (session) {
        session.senderSocket = socket;
        console.log(`Sender joined session: ${code}`);
    }
    return session;
}

/**
 * Set receiver socket for a session
 */
function setReceiverSocket(code, socket) {
    const session = sessions.get(code);
    if (session) {
        session.receiverSocket = socket;
        console.log(`Receiver joined session: ${code}`);
    }
    return session;
}

/**
 * Set file metadata for a session
 */
function setFileMeta(code, fileMeta) {
    const session = sessions.get(code);
    if (session) {
        session.fileMeta = fileMeta;
        console.log(`File meta set for session: ${code}`, fileMeta.name);
    }
    return session;
}

/**
 * Delete a session
 */
function deleteSession(code) {
    if (sessions.has(code)) {
        sessions.delete(code);
        console.log(`Session deleted: ${code}`);
        return true;
    }
    return false;
}

/**
 * Find session by socket ID
 */
function findSessionBySocket(socketId) {
    for (const [code, session] of sessions.entries()) {
        if (session.senderSocket?.id === socketId || session.receiverSocket?.id === socketId) {
            return { code, session, role: session.senderSocket?.id === socketId ? 'sender' : 'receiver' };
        }
    }
    return null;
}

/**
 * Cleanup expired sessions
 */
function cleanupExpiredSessions() {
    const now = Date.now();
    let cleaned = 0;
    for (const [code, session] of sessions.entries()) {
        if (now - session.createdAt > SESSION_TIMEOUT) {
            sessions.delete(code);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} expired sessions`);
    }
}

module.exports = {
    createSession,
    getSession,
    setSenderSocket,
    setReceiverSocket,
    setFileMeta,
    deleteSession,
    findSessionBySocket,
    cleanupExpiredSessions
};
