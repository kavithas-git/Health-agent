const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// ── Serverless-optimized connection pool ────────────────────
// In a serverless environment each container has its own pool.
// Conservative settings prevent connection exhaustion on the
// managed database (Neon, Supabase, etc.) while keeping cold
// starts fast.
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Serverless: 1 connection per container; local: up to 10
  max: isProduction ? 1 : 10,

  // Close idle connections after 10 seconds (serverless containers
  // are short-lived; don't hold connections open indefinitely)
  idleTimeoutMillis: 10000,

  // Fail fast if the database is unreachable
  connectionTimeoutMillis: 5000,

  // SSL configuration for managed cloud databases
  // Most providers (Neon, Supabase, Railway) require SSL.
  // rejectUnauthorized: false allows self-signed certificates
  // used by some providers' connection poolers.
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') || isProduction
    ? { rejectUnauthorized: false }
    : false,
});

// Gracefully handle unexpected pool errors to prevent crashes
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Execute a query against the PostgreSQL database.
 * Wraps pool.query for convenience and consistent error logging.
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[DB] Query executed', { text: text.substring(0, 80), duration: `${duration}ms`, rows: result.rowCount });
    }
    return result;
  } catch (error) {
    console.error('[DB] Query error:', error.message);
    throw error;
  }
};

/**
 * Check database connectivity by executing a simple query.
 */
const healthCheck = async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('[DB] Health check passed:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('[DB] Health check FAILED:', error.message);
    return false;
  }
};

/**
 * Read and execute the schema.sql file to initialize tables.
 * Called at server startup to ensure all tables exist.
 * Uses CREATE IF NOT EXISTS so it is safe to run repeatedly
 * (idempotent on every cold start).
 */
const initializeDatabase = async () => {
  try {
    const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(schemaSql);
    console.log('[DB] Database schema initialized successfully.');
  } catch (error) {
    console.error('[DB] Failed to initialize database schema:', error.message);
    throw error;
  }
};

module.exports = { pool, query, healthCheck, initializeDatabase };
