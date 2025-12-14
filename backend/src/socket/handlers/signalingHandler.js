const sessionService = require('../../services/sessionService');

class SignalingHandler {
    /**
     * Handle sender joining a session
     */
    handleSenderJoin(socket, code) {
        const session = sessionService.setSenderSocket(code, socket);
        if (session) {
            socket.join(code);
            socket.emit('session-joined', { code, role: 'sender' });
        } else {
            socket.emit('error', { message: 'Session not found' });
        }
    }

    /**
     * Handle receiver joining a session
     */
    handleReceiverJoin(socket, code) {
        const session = sessionService.getSession(code);
        if (!session) {
            socket.emit('error', { message: 'Session not found' });
            return;
        }
        if (!session.senderSocket) {
            socket.emit('error', { message: 'Sender not connected' });
            return;
        }

        sessionService.setReceiverSocket(code, socket);
        socket.join(code);
        socket.emit('session-joined', { code, role: 'receiver' });

        // Notify sender that receiver connected
        session.senderSocket.emit('receiver-connected');

        // Send file meta to receiver if available
        if (session.fileMeta) {
            socket.emit('file-meta', session.fileMeta);
        }
    }

    /**
     * Handle file metadata sharing
     */
    handleFileMeta(socket, data) {
        const result = sessionService.findSessionBySocket(socket.id);
        if (result && result.role === 'sender') {
            sessionService.setFileMeta(result.code, data);
            // Forward to receiver if connected
            if (result.session.receiverSocket) {
                result.session.receiverSocket.emit('file-meta', data);
            }
        }
    }

    /**
     * Handle WebRTC offer
     */
    handleOffer(socket, data) {
        const result = sessionService.findSessionBySocket(socket.id);
        if (result && result.session.receiverSocket) {
            result.session.receiverSocket.emit('offer', data);
        }
    }

    /**
     * Handle WebRTC answer
     */
    handleAnswer(socket, data) {
        const result = sessionService.findSessionBySocket(socket.id);
        if (result && result.session.senderSocket) {
            result.session.senderSocket.emit('answer', data);
        }
    }

    /**
     * Handle ICE candidate
     */
    handleIceCandidate(socket, data) {
        const result = sessionService.findSessionBySocket(socket.id);
        if (result) {
            const targetSocket = result.role === 'sender'
                ? result.session.receiverSocket
                : result.session.senderSocket;
            if (targetSocket) {
                targetSocket.emit('ice-candidate', data);
            }
        }
    }

    /**
     * Handle transfer acceptance
     */
    handleAcceptTransfer(socket) {
        const result = sessionService.findSessionBySocket(socket.id);
        if (result && result.role === 'receiver' && result.session.senderSocket) {
            result.session.senderSocket.emit('transfer-accepted');
        }
    }

    /**
     * Handle transfer rejection
     */
    handleRejectTransfer(socket) {
        const result = sessionService.findSessionBySocket(socket.id);
        if (result && result.role === 'receiver' && result.session.senderSocket) {
            result.session.senderSocket.emit('transfer-rejected');
            sessionService.deleteSession(result.code);
        }
    }

    /**
     * Handle transfer completion
     */
    handleTransferComplete(socket, data) {
        const result = sessionService.findSessionBySocket(socket.id);
        if (result) {
            const otherSocket = result.role === 'sender'
                ? result.session.receiverSocket
                : result.session.senderSocket;
            if (otherSocket) {
                otherSocket.emit('transfer-complete', data);
            }
            sessionService.deleteSession(result.code);
        }
    }

    /**
     * Handle transfer error
     */
    handleTransferError(socket, data) {
        const result = sessionService.findSessionBySocket(socket.id);
        if (result) {
            const otherSocket = result.role === 'sender'
                ? result.session.receiverSocket
                : result.session.senderSocket;
            if (otherSocket) {
                otherSocket.emit('transfer-error', data);
            }
        }
    }

    /**
     * Handle client disconnect
     */
    handleDisconnect(socket) {
        console.log(`Client disconnected: ${socket.id}`);
        const result = sessionService.findSessionBySocket(socket.id);
        if (result) {
            const otherSocket = result.role === 'sender'
                ? result.session.receiverSocket
                : result.session.senderSocket;
            if (otherSocket) {
                otherSocket.emit('peer-disconnected', { role: result.role });
            }
            // Delete session if sender disconnects
            if (result.role === 'sender') {
                sessionService.deleteSession(result.code);
            }
        }
    }
}

module.exports = new SignalingHandler();
