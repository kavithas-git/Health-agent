const express = require('express');
const router = express.Router();
const { analyzeAndSave, getHistory } = require('../controllers/triageController');
const authMiddleware = require('../middleware/authMiddleware');

// All assessment routes require authentication
router.use(authMiddleware);

// POST — submit symptoms for AI triage analysis
router.post('/analyze', analyzeAndSave);

// GET — retrieve past assessment history
router.get('/history', getHistory);

module.exports = router;
