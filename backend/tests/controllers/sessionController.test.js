const request = require('supertest');
const { app } = require('../../src/app');
const sessionService = require('../../src/services/sessionService');

describe('SessionController', () => {
    describe('GET /api/health', () => {
        it('should return health check status', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toMatchObject({
                status: 'ok'
            });
            expect(response.body.timestamp).toBeDefined();
            expect(response.body.sessions).toBeDefined();
            expect(typeof response.body.sessions).toBe('number');
        });
    });

    describe('POST /api/create-session', () => {
        it('should create a new session and return a code', async () => {
            const response = await request(app)
                .post('/api/create-session')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body.code).toBeDefined();
            expect(response.body.code).toMatch(/^\d{6}$/);
        });

        it('should create unique session codes', async () => {
            const response1 = await request(app)
                .post('/api/create-session')
                .expect(200);

            const response2 = await request(app)
                .post('/api/create-session')
                .expect(200);

            expect(response1.body.code).not.toBe(response2.body.code);
        });
    });

    describe('GET /api/session/:code', () => {
        it('should return session info for existing session', async () => {
            // Create a session first
            const createResponse = await request(app)
                .post('/api/create-session')
                .expect(200);

            const code = createResponse.body.code;

            // Get session info
            const response = await request(app)
                .get(`/api/session/${code}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toMatchObject({
                exists: true,
                hasReceiver: false,
                fileMeta: null
            });
        });

        it('should return exists:false for non-existent session', async () => {
            const response = await request(app)
                .get('/api/session/999999')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toMatchObject({
                exists: false
            });
        });

        it('should show hasReceiver:true when receiver is connected', async () => {
            const code = sessionService.createSession();
            const mockSocket = { id: 'receiver-123' };
            sessionService.setReceiverSocket(code, mockSocket);

            const response = await request(app)
                .get(`/api/session/${code}`)
                .expect(200);

            expect(response.body.hasReceiver).toBe(true);
        });

        it('should return file metadata when available', async () => {
            const code = sessionService.createSession();
            const fileMeta = {
                name: 'test.txt',
                size: 1024,
                type: 'text/plain'
            };
            sessionService.setFileMeta(code, fileMeta);

            const response = await request(app)
                .get(`/api/session/${code}`)
                .expect(200);

            expect(response.body.fileMeta).toEqual(fileMeta);
        });
    });
});
