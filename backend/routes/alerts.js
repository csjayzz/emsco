const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const alertsController = require('../controllers/alertsController');

router.patch('/:id/acknowledge', auth, role('police'), alertsController.acknowledge);
router.get('/history', auth, role('police'), alertsController.history);

module.exports = router;
