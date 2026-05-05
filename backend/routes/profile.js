const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const profileController = require('../controllers/profileController');

router.get('/', auth, profileController.get);
router.patch('/', auth, profileController.update);
router.get('/trips', auth, role('ambulance'), profileController.trips);
router.get('/alerts', auth, role('police'), profileController.alerts);

module.exports = router;
