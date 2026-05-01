const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const officersController = require('../controllers/officersController');

router.get('/active', auth, role('ambulance'), officersController.getActive);

module.exports = router;
