const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const ridesController = require('../controllers/ridesController');
const preArrivalController = require('../controllers/preArrivalController');

// Ride CRUD
router.post('/', auth, role('ambulance'), ridesController.create);
router.patch('/:id/location', auth, role('ambulance'), ridesController.updateLocation);
router.patch('/:id/end', auth, role('ambulance'), ridesController.endRide);
router.get('/history', auth, role('ambulance'), ridesController.history);

// Pre-arrival (nested under rides)
router.post('/:id/pre-arrival', auth, role('ambulance'), preArrivalController.create);
router.get('/:id/pre-arrival', auth, preArrivalController.get);

module.exports = router;
