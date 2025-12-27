const sessionService = require('../../src/services/sessionService');

describe('SessionService', () => {
    beforeEach(() => {
        // Clear all sessions before each test
        const sessions = sessionService.cleanupExpiredSessions();
    });

    describe('generateCode', () => {
        it('should generate a 6-digit code', () => {
            const code = sessionService.generateCode();
            expect(code).toMatch(/^\d{6}$/);
        });

        it('should generate unique codes', () => {
            const codes = new Set();
            for (let i = 0; i < 100; i++) {
                codes.add(sessionService.generateCode());
            }
            expect(codes.size).toBeGreaterThan(90); // Allow some collision due to randomness
        });
    });

    describe('createSession', () => {
        it('should create a new session and return a code', () => {
            const code = sessionService.createSession();
            expect(code).toBeTruthy();
            expect(code).toMatch(/^\d{6}$/);
        });

        it('should create a session with correct initial structure', () => {
            const code = sessionService.createSession();
            const session = sessionService.getSession(code);
            
            expect(session).toMatchObject({
                code,
                senderSocket: null,
                receiverSocket: null,
                fileMeta: null
            });
            expect(session.createdAt).toBeDefined();
            expect(typeof session.createdAt).toBe('number');
        });

        it('should increment sessions count', () => {
            const initialCount = sessionService.getSessionsCount();
            sessionService.createSession();
            expect(sessionService.getSessionsCount()).toBe(initialCount + 1);
        });
    });

    describe('getSession', () => {
        it('should return session by code', () => {
            const code = sessionService.createSession();
            const session = sessionService.getSession(code);
            expect(session).toBeTruthy();
            expect(session.code).toBe(code);
        });

        it('should return undefined for non-existent session', () => {
            const session = sessionService.getSession('999999');
            expect(session).toBeUndefined();
        });
    });

    describe('setSenderSocket', () => {
        it('should set sender socket for existing session', () => {
            const code = sessionService.createSession();
            const mockSocket = { id: 'socket-123' };
            
            const session = sessionService.setSenderSocket(code, mockSocket);
            expect(session.senderSocket).toBe(mockSocket);
        });

        it('should return undefined for non-existent session', () => {
            const mockSocket = { id: 'socket-123' };
            const session = sessionService.setSenderSocket('999999', mockSocket);
            expect(session).toBeUndefined();
        });
    });

    describe('setReceiverSocket', () => {
        it('should set receiver socket for existing session', () => {
            const code = sessionService.createSession();
            const mockSocket = { id: 'socket-456' };
            
            const session = sessionService.setReceiverSocket(code, mockSocket);
            expect(session.receiverSocket).toBe(mockSocket);
        });

        it('should return undefined for non-existent session', () => {
            const mockSocket = { id: 'socket-456' };
            const session = sessionService.setReceiverSocket('999999', mockSocket);
            expect(session).toBeUndefined();
        });
    });

    describe('setFileMeta', () => {
        it('should set file metadata for existing session', () => {
            const code = sessionService.createSession();
            const fileMeta = {
                name: 'test.txt',
                size: 1024,
                type: 'text/plain'
            };
            
            const session = sessionService.setFileMeta(code, fileMeta);
            expect(session.fileMeta).toEqual(fileMeta);
        });

        it('should return undefined for non-existent session', () => {
            const fileMeta = { name: 'test.txt' };
            const session = sessionService.setFileMeta('999999', fileMeta);
            expect(session).toBeUndefined();
        });
    });

    describe('deleteSession', () => {
        it('should delete existing session and return true', () => {
            const code = sessionService.createSession();
            const result = sessionService.deleteSession(code);
            
            expect(result).toBe(true);
            expect(sessionService.getSession(code)).toBeUndefined();
        });

        it('should return false for non-existent session', () => {
            const result = sessionService.deleteSession('999999');
            expect(result).toBe(false);
        });
    });

    describe('findSessionBySocket', () => {
        it('should find session by sender socket ID', () => {
            const code = sessionService.createSession();
            const senderSocket = { id: 'sender-123' };
            sessionService.setSenderSocket(code, senderSocket);
            
            const result = sessionService.findSessionBySocket('sender-123');
            expect(result).toBeTruthy();
            expect(result.code).toBe(code);
            expect(result.role).toBe('sender');
        });

        it('should find session by receiver socket ID', () => {
            const code = sessionService.createSession();
            const receiverSocket = { id: 'receiver-456' };
            sessionService.setReceiverSocket(code, receiverSocket);
            
            const result = sessionService.findSessionBySocket('receiver-456');
            expect(result).toBeTruthy();
            expect(result.code).toBe(code);
            expect(result.role).toBe('receiver');
        });

        it('should return null for non-existent socket', () => {
            const result = sessionService.findSessionBySocket('non-existent');
            expect(result).toBeNull();
        });
    });

    describe('getSessionsCount', () => {
        it('should return correct count of sessions', () => {
            const initialCount = sessionService.getSessionsCount();
            sessionService.createSession();
            sessionService.createSession();
            
            expect(sessionService.getSessionsCount()).toBe(initialCount + 2);
        });
    });
});
