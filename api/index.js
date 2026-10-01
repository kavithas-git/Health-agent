/**
 * api/index.js — Vercel Serverless Function Entry Point
 *
 * Imports the fully-configured Express application and exposes it
 * as a serverless handler. Database schema is lazily initialized
 * once per container lifecycle (cold start) using CREATE IF NOT EXISTS,
 * so it is safe and idempotent.
 */

const path = require('path');

// Load environment variables from backend/.env for local development.
// On Vercel (both `vercel dev` and production), env vars are injected
// by the platform, and dotenv silently no-ops if the file is absent.
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

const app = require('../backend/server');
const { initializeDatabase } = require('../backend/config/db');

// ── Lazy one-time database initialization per container ─────
let dbReady = null;

function ensureDatabaseReady() {
  if (!dbReady) {
    dbReady = initializeDatabase()
      .then(() => {
        console.log('[Vercel] Database schema initialized (cold start).');
      })
      .catch((err) => {
        console.error('[Vercel] Database initialization failed:', err.message);
        // Reset so it retries on the next request
        dbReady = null;
        throw err;
      });
  }
  return dbReady;
}

// ── Serverless handler wrapper ──────────────────────────────
module.exports = async (req, res) => {
  try {
    await ensureDatabaseReady();
  } catch (err) {
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable. Database initialization failed.',
    });
  }
  return app(req, res);
};
