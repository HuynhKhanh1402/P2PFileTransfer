const signalingHandler = require('../../../src/socket/handlers/signalingHandler');
const sessionService = require('../../../src/services/sessionService');

describe('SignalingHandler', () => {
    let mockSocket;

    beforeEach(() => {
        mockSocket = {
            id: 'test-socket-id',
            join: jest.fn(),
            emit: jest.fn()
        };
    });

    describe('handleSenderJoin', () => {
        it('should allow sender to join existing session', () => {
            const code = sessionService.createSession();
            
            signalingHandler.handleSenderJoin(mockSocket, code);
            
            expect(mockSocket.join).toHaveBeenCalledWith(code);
            expect(mockSocket.emit).toHaveBeenCalledWith('session-joined', {
                code,
                role: 'sender'
            });
        });

        it('should emit error for non-existent session', () => {
            signalingHandler.handleSenderJoin(mockSocket, '999999');
            
            expect(mockSocket.emit).toHaveBeenCalledWith('error', {
                message: 'Session not found'
            });
        });
    });

    describe('handleReceiverJoin', () => {
        it('should allow receiver to join session with active sender', () => {
            const code = sessionService.createSession();
            const senderSocket = {
                id: 'sender-id',
                emit: jest.fn()
            };
            const receiverSocket = {
                id: 'receiver-id',
                join: jest.fn(),
                emit: jest.fn()
            };
            
            sessionService.setSenderSocket(code, senderSocket);
            
            signalingHandler.handleReceiverJoin(receiverSocket, code);
            
            expect(receiverSocket.join).toHaveBeenCalledWith(code);
            expect(receiverSocket.emit).toHaveBeenCalledWith('session-joined', {
                code,
                role: 'receiver'
            });
            expect(senderSocket.emit).toHaveBeenCalledWith('receiver-connected');
        });

        it('should emit error for non-existent session', () => {
            signalingHandler.handleReceiverJoin(mockSocket, '999999');
            
            expect(mockSocket.emit).toHaveBeenCalledWith('error', {
                message: 'Session not found'
            });
        });

        it('should emit error when sender is not connected', () => {
            const code = sessionService.createSession();
            
            signalingHandler.handleReceiverJoin(mockSocket, code);
            
            expect(mockSocket.emit).toHaveBeenCalledWith('error', {
                message: 'Sender not connected'
            });
        });

        it('should send file metadata to receiver if available', () => {
            const code = sessionService.createSession();
            const fileMeta = { name: 'test.txt', size: 1024 };
            const senderSocket = {
                id: 'sender-id',
                emit: jest.fn()
            };
            const receiverSocket = {
                id: 'receiver-id',
                join: jest.fn(),
                emit: jest.fn()
            };
            
            sessionService.setSenderSocket(code, senderSocket);
            sessionService.setFileMeta(code, fileMeta);
            
            signalingHandler.handleReceiverJoin(receiverSocket, code);
            
            expect(receiverSocket.emit).toHaveBeenCalledWith('file-meta', fileMeta);
        });
    });

    describe('handleFileMeta', () => {
        it('should call handleFileMeta without errors', () => {
            const code = sessionService.createSession();
            sessionService.setSenderSocket(code, mockSocket);
            
            const fileMeta = { name: 'test.txt', size: 1024 };
            
            expect(() => {
                signalingHandler.handleFileMeta(mockSocket, fileMeta);
            }).not.toThrow();
        });
    });

    describe('handleOffer', () => {
        it('should call handleOffer without errors', () => {
            const offer = { type: 'offer', sdp: 'test-sdp' };
            
            expect(() => {
                signalingHandler.handleOffer(mockSocket, offer);
            }).not.toThrow();
        });
    });

    describe('handleAnswer', () => {
        it('should call handleAnswer without errors', () => {
            const answer = { type: 'answer', sdp: 'test-sdp' };
            
            expect(() => {
                signalingHandler.handleAnswer(mockSocket, answer);
            }).not.toThrow();
        });
    });

    describe('handleIceCandidate', () => {
        it('should call handleIceCandidate without errors', () => {
            const candidate = { candidate: 'test-candidate' };
            
            expect(() => {
                signalingHandler.handleIceCandidate(mockSocket, candidate);
            }).not.toThrow();
        });
    });

    describe('handleAcceptTransfer', () => {
        it('should call handleAcceptTransfer without errors', () => {
            expect(() => {
                signalingHandler.handleAcceptTransfer(mockSocket);
            }).not.toThrow();
        });
    });

    describe('handleRejectTransfer', () => {
        it('should call handleRejectTransfer without errors', () => {
            expect(() => {
                signalingHandler.handleRejectTransfer(mockSocket);
            }).not.toThrow();
        });
    });

    describe('handleTransferComplete', () => {
        it('should call handleTransferComplete without errors', () => {
            const data = { success: true };
            
            expect(() => {
                signalingHandler.handleTransferComplete(mockSocket, data);
            }).not.toThrow();
        });
    });

    describe('handleTransferError', () => {
        it('should call handleTransferError without errors', () => {
            const errorData = { error: 'Transfer failed' };
            
            expect(() => {
                signalingHandler.handleTransferError(mockSocket, errorData);
            }).not.toThrow();
        });
    });

    describe('handleDisconnect', () => {
        it('should call handleDisconnect without errors', () => {
            expect(() => {
                signalingHandler.handleDisconnect(mockSocket);
            }).not.toThrow();
        });
    });
});
