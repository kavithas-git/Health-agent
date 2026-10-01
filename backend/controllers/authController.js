const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

/**
 * Generate a signed JWT token for a patient.
 */
const generateToken = (patient) => {
  return jwt.sign(
    { id: patient.id, email: patient.email, name: patient.name },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * POST /api/auth/register
 * Register a new patient account.
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // ── Validation ──────────────────────────────────────────
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: name, email, and password.',
      });
    }

    if (name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Name must be between 2 and 100 characters.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      });
    }

    // ── Check for existing email ────────────────────────────
    const existingPatient = await query(
      'SELECT id FROM patients WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (existingPatient.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // ── Hash password and insert ────────────────────────────
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await query(
      `INSERT INTO patients (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name.trim(), email.toLowerCase().trim(), passwordHash]
    );

    const patient = result.rows[0];
    const token = generateToken(patient);

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        token,
        patient: {
          id: patient.id,
          name: patient.name,
          email: patient.email,
          created_at: patient.created_at,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Authenticate a patient and return a JWT.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // ── Validation ──────────────────────────────────────────
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    // ── Find patient ────────────────────────────────────────
    const result = await query(
      'SELECT id, name, email, password_hash FROM patients WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const patient = result.rows[0];

    // ── Verify password ─────────────────────────────────────
    const isPasswordValid = await bcrypt.compare(password, patient.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // ── Issue token ─────────────────────────────────────────
    const token = generateToken(patient);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        patient: {
          id: patient.id,
          name: patient.name,
          email: patient.email,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/verify
 * Verify that the caller's JWT is still valid. (Protected route)
 */
const verifyToken = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Token is valid.',
    data: {
      patient: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
      },
    },
  });
};

module.exports = { register, login, verifyToken };
