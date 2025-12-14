const express = require('express');
const sessionController = require('../controllers/sessionController');

const router = express.Router();

router.get('/health', sessionController.healthCheck.bind(sessionController));
router.post('/create-session', sessionController.createSession.bind(sessionController));
router.get('/session/:code', sessionController.getSession.bind(sessionController));

module.exports = router;
