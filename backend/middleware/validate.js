/**
 * Reusable input-validation middleware factory.
 *
 * Usage:
 *   validate({ name: 'required', email: 'email', password: 'min:6' })
 *   validate({ role: 'required|in:ambulance,police', age: 'min:1|max:120' })
 *
 * Supported rules (pipe-separated):
 *   required        — field must be present and non-empty
 *   email           — must look like a valid email
 *   min:N           — string length >= N  (or numeric value >= N)
 *   max:N           — string length <= N  (or numeric value <= N)
 *   in:a,b,c        — value must be one of the listed options
 */
module.exports = (schema) => {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rulesStr] of Object.entries(schema)) {
      const rules = rulesStr.split('|');
      const value = req.body[field];

      for (const rule of rules) {
        // --- required ---
        if (rule === 'required') {
          if (value === undefined || value === null || value === '') {
            errors.push(`${field} is required`);
            break; // no point checking further rules
          }
        }

        // --- email ---
        if (rule === 'email' && value) {
          const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRe.test(value)) {
            errors.push(`${field} must be a valid email`);
          }
        }

        // --- min:N ---
        if (rule.startsWith('min:') && value) {
          const min = parseInt(rule.split(':')[1], 10);
          const len = typeof value === 'string' ? value.length : value;
          if (len < min) {
            errors.push(`${field} must be at least ${min}${typeof value === 'string' ? ' characters' : ''}`);
          }
        }

        // --- max:N ---
        if (rule.startsWith('max:') && value) {
          const max = parseInt(rule.split(':')[1], 10);
          const len = typeof value === 'string' ? value.length : value;
          if (len > max) {
            errors.push(`${field} must be at most ${max}${typeof value === 'string' ? ' characters' : ''}`);
          }
        }

        // --- in:a,b,c ---
        if (rule.startsWith('in:') && value) {
          const allowed = rule.split(':')[1].split(',');
          if (!allowed.includes(value)) {
            errors.push(`${field} must be one of: ${allowed.join(', ')}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }
    next();
  };
};
