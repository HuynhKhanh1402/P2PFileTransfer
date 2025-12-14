const sessionManager = require('../sessions/sessionManager');

function setupSignaling(io) {
    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);

        // Sender joins with code
        socket.on('sender-join', (code) => {
            const session = sessionManager.setSenderSocket(code, socket);
            if (session) {
                socket.join(code);
                socket.emit('session-joined', { code, role: 'sender' });
            } else {
                socket.emit('error', { message: 'Session not found' });
            }
        });

        // Receiver joins with code
        socket.on('receiver-join', (code) => {
            const session = sessionManager.getSession(code);
            if (!session) {
                socket.emit('error', { message: 'Session not found' });
                return;
            }
            if (!session.senderSocket) {
                socket.emit('error', { message: 'Sender not connected' });
                return;
            }

            sessionManager.setReceiverSocket(code, socket);
            socket.join(code);
            socket.emit('session-joined', { code, role: 'receiver' });

            // Notify sender that receiver connected
            session.senderSocket.emit('receiver-connected');

            // Send file meta to receiver if available
            if (session.fileMeta) {
                socket.emit('file-meta', session.fileMeta);
            }
        });

        // Sender shares file metadata
        socket.on('file-meta', (data) => {
            const result = sessionManager.findSessionBySocket(socket.id);
            if (result && result.role === 'sender') {
                sessionManager.setFileMeta(result.code, data);
                // Forward to receiver if connected
                if (result.session.receiverSocket) {
                    result.session.receiverSocket.emit('file-meta', data);
                }
            }
        });

        // WebRTC signaling: offer
        socket.on('offer', (data) => {
            const result = sessionManager.findSessionBySocket(socket.id);
            if (result && result.session.receiverSocket) {
                result.session.receiverSocket.emit('offer', data);
            }
        });

        // WebRTC signaling: answer
        socket.on('answer', (data) => {
            const result = sessionManager.findSessionBySocket(socket.id);
            if (result && result.session.senderSocket) {
                result.session.senderSocket.emit('answer', data);
            }
        });

        // WebRTC signaling: ICE candidate
        socket.on('ice-candidate', (data) => {
            const result = sessionManager.findSessionBySocket(socket.id);
            if (result) {
                const targetSocket = result.role === 'sender'
                    ? result.session.receiverSocket
                    : result.session.senderSocket;
                if (targetSocket) {
                    targetSocket.emit('ice-candidate', data);
                }
            }
        });

        // Receiver accepts transfer
        socket.on('accept-transfer', () => {
            const result = sessionManager.findSessionBySocket(socket.id);
            if (result && result.role === 'receiver' && result.session.senderSocket) {
                result.session.senderSocket.emit('transfer-accepted');
            }
        });

        // Receiver rejects transfer
        socket.on('reject-transfer', () => {
            const result = sessionManager.findSessionBySocket(socket.id);
            if (result && result.role === 'receiver' && result.session.senderSocket) {
                result.session.senderSocket.emit('transfer-rejected');
                sessionManager.deleteSession(result.code);
            }
        });

        // Transfer complete
        socket.on('transfer-complete', (data) => {
            const result = sessionManager.findSessionBySocket(socket.id);
            if (result) {
                const otherSocket = result.role === 'sender'
                    ? result.session.receiverSocket
                    : result.session.senderSocket;
                if (otherSocket) {
                    otherSocket.emit('transfer-complete', data);
                }
                // Clean up session after transfer
                sessionManager.deleteSession(result.code);
            }
        });

        // Transfer error
        socket.on('transfer-error', (data) => {
            const result = sessionManager.findSessionBySocket(socket.id);
            if (result) {
                const otherSocket = result.role === 'sender'
                    ? result.session.receiverSocket
                    : result.session.senderSocket;
                if (otherSocket) {
                    otherSocket.emit('transfer-error', data);
                }
            }
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
            const result = sessionManager.findSessionBySocket(socket.id);
            if (result) {
                const otherSocket = result.role === 'sender'
                    ? result.session.receiverSocket
                    : result.session.senderSocket;
                if (otherSocket) {
                    otherSocket.emit('peer-disconnected', { role: result.role });
                }
                // Delete session if sender disconnects
                if (result.role === 'sender') {
                    sessionManager.deleteSession(result.code);
                }
            }
        });
    });
}

module.exports = { setupSignaling };
