const jwt = require('jsonwebtoken');

/**
 * JWT authentication middleware.
 * Verifies the Authorization: Bearer <token> header and attaches
 * the decoded payload to req.user = { id, role, name }.
 */
module.exports = (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role, name: decoded.name };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
