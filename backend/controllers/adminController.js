const pool = require('../db');
const logger = require('../utils/logger');

/**
 * POST /admin/hospitals — create a new hospital
 */
exports.createHospital = async (req, res) => {
  try {
    const { name, lat, lng, address, phone, specializations, bed_count, trauma_level } = req.body;

    if (!name || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'name, lat, and lng are required' });
    }
    if (lat < -90 || lat > 90) {
      return res.status(400).json({ error: 'lat must be between -90 and 90' });
    }
    if (lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'lng must be between -180 and 180' });
    }

    const result = await pool.query(
      `INSERT INTO hospitals (name, lat, lng, address, phone, specializations, bed_count, trauma_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, lat, lng, address || null, phone || null, specializations || null, bed_count || null, trauma_level || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Create hospital error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to create hospital' });
  }
};

/**
 * PATCH /admin/hospitals/:id — update hospital fields
 */
exports.updateHospital = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['name', 'lat', 'lng', 'address', 'phone', 'specializations', 'bed_count', 'trauma_level'];
    const updates = [];
    const values = [];
    let idx = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx}`);
        values.push(req.body[field]);
        idx++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE hospitals SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Update hospital error', { error: err.message, stack: err.stack, hospitalId: req.params.id });
    res.status(500).json({ error: 'Failed to update hospital' });
  }
};

/**
 * DELETE /admin/hospitals/:id — soft-delete (set is_active = false)
 */
exports.deleteHospital = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE hospitals SET is_active = false WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    res.json({ message: 'Hospital deactivated' });
  } catch (err) {
    logger.error('Delete hospital error', { error: err.message, stack: err.stack, hospitalId: req.params.id });
    res.status(500).json({ error: 'Failed to delete hospital' });
  }
};
