const path = require('path');

// Load environment variables from backend/.env.
// On Vercel, env vars are injected by the platform; dotenv silently
// no-ops when the file is absent or env vars are already set.
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { healthCheck, initializeDatabase } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const triageRoutes = require('./routes/triageRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security Middleware ─────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Relaxed for serving frontend HTML
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Rate limiting: 100 requests per 15-minute window per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
});
app.use('/api/', limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
});
app.use('/api/auth/', authLimiter);

// ── Body Parsing ────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Serve Frontend Static Files (local development only) ────
// On Vercel, static assets in public/ are served by the CDN.
if (!process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, '..', 'public')));
}

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/assessments', triageRoutes);

// ── Health Check Endpoint ───────────────────────────────────
app.get('/api/health', async (_req, res) => {
  const dbHealthy = await healthCheck();
  res.status(dbHealthy ? 200 : 503).json({
    success: dbHealthy,
    status: dbHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'connected' : 'disconnected',
    },
  });
});

// ── Catch-all: serve index.html for unmatched routes ────────
// Only needed for local dev; Vercel serves static files directly.
if (!process.env.VERCEL) {
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ success: false, message: 'API endpoint not found.' });
    }
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });
}

// ── Error Handling Middleware ────────────────────────────────
app.use(errorHandler);

// ── Start Server (local development only) ───────────────────
// When deployed to Vercel, the app is imported by api/index.js
// and invoked as a serverless function — no persistent listener.
if (!process.env.VERCEL) {
  const startServer = async () => {
    try {
      // Initialize database tables
      await initializeDatabase();
      console.log('[SERVER] Database initialized.');

      app.listen(PORT, () => {
        console.log(`\n🩺  AI Health Triage Agent`);
        console.log(`   Server running on http://localhost:${PORT}`);
        console.log(`   API base: http://localhost:${PORT}/api`);
        console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
      });
    } catch (error) {
      console.error('[SERVER] Failed to start:', error.message);
      process.exit(1);
    }
  };

  startServer();
}

// Export the Express app for Vercel serverless consumption
module.exports = app;
