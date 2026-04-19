/**
 * Role-based authorization middleware factory.
 * Usage: role('ambulance', 'admin')  — allows ambulance OR admin roles.
 * Must be used AFTER the auth middleware so req.user is available.
 */
module.exports = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
