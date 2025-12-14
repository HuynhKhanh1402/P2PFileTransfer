const sessionService = require('../services/sessionService');

class SessionController {
    /**
     * Health check endpoint
     */
    healthCheck(req, res) {
        res.json({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            sessions: sessionService.getSessionsCount()
        });
    }

    /**
     * Create a new session
     */
    createSession(req, res) {
        try {
            const code = sessionService.createSession();
            res.json({ code });
        } catch (error) {
            console.error('Error creating session:', error);
            res.status(500).json({ error: 'Failed to create session' });
        }
    }

    /**
     * Get session information
     */
    getSession(req, res) {
        const { code } = req.params;
        const session = sessionService.getSession(code);
        
        if (session) {
            res.json({ 
                exists: true, 
                hasReceiver: !!session.receiverSocket,
                fileMeta: session.fileMeta || null
            });
        } else {
            res.json({ exists: false });
        }
    }
}

module.exports = new SessionController();
