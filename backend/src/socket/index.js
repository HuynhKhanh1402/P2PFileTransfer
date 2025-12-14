const signalingHandler = require('./handlers/signalingHandler');

function setupSocketIO(io) {
    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);

        // Session events
        socket.on('sender-join', (code) => signalingHandler.handleSenderJoin(socket, code));
        socket.on('receiver-join', (code) => signalingHandler.handleReceiverJoin(socket, code));
        socket.on('file-meta', (data) => signalingHandler.handleFileMeta(socket, data));

        // WebRTC signaling events
        socket.on('offer', (data) => signalingHandler.handleOffer(socket, data));
        socket.on('answer', (data) => signalingHandler.handleAnswer(socket, data));
        socket.on('ice-candidate', (data) => signalingHandler.handleIceCandidate(socket, data));

        // Transfer events
        socket.on('accept-transfer', () => signalingHandler.handleAcceptTransfer(socket));
        socket.on('reject-transfer', () => signalingHandler.handleRejectTransfer(socket));
        socket.on('transfer-complete', (data) => signalingHandler.handleTransferComplete(socket, data));
        socket.on('transfer-error', (data) => signalingHandler.handleTransferError(socket, data));

        // Disconnect event
        socket.on('disconnect', () => signalingHandler.handleDisconnect(socket));
    });
}

module.exports = { setupSocketIO };
