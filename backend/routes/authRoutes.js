const express = require('express');
const router = express.Router();
const { register, login, verifyToken } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected route — verify token validity
router.get('/verify', authMiddleware, verifyToken);

module.exports = router;
