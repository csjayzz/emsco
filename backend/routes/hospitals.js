const router = require('express').Router();
const auth = require('../middleware/auth');
const hospitalsController = require('../controllers/hospitalsController');

router.get('/', auth, hospitalsController.getAll);

module.exports = router;
