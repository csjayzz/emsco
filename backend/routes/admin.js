const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const adminController = require('../controllers/adminController');

router.post('/hospitals', auth, role('admin'), adminController.createHospital);
router.patch('/hospitals/:id', auth, role('admin'), adminController.updateHospital);
router.delete('/hospitals/:id', auth, role('admin'), adminController.deleteHospital);

module.exports = router;
