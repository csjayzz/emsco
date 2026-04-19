const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const logger = require('../utils/logger');

// Roles allowed via the public registration endpoint.
// 'admin' accounts must be created directly in the database.
const ALLOWED_REGISTRATION_ROLES = ['ambulance', 'police'];

/**
 * POST /auth/register
 * Creates a new user account, hashes the password, and returns a JWT.
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, vehicle_id, badge_number } = req.body;

    // Prevent privilege escalation — admin accounts cannot be created via API
    if (!ALLOWED_REGISTRATION_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${ALLOWED_REGISTRATION_ROLES.join(', ')}` });
    }

    // Check email uniqueness
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, vehicle_id, badge_number)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, role`,
      [name, email, password_hash, role, vehicle_id || null, badge_number || null]
    );

    const user = result.rows[0];

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info('User registered', { userId: user.id, role: user.role });

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, role: user.role }
    });
  } catch (err) {
    logger.error('Register error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Registration failed' });
  }
};

/**
 * POST /auth/login
 * Authenticates an existing user and returns a JWT.
 * Uses identical error messages for wrong email vs. wrong password
 * to avoid leaking which one failed.
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Compare password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check active
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info('User logged in', { userId: user.id, role: user.role });

    res.json({
      token,
      user: { id: user.id, name: user.name, role: user.role }
    });
  } catch (err) {
    logger.error('Login error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Login failed' });
  }
};
