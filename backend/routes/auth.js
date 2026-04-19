const router = require('express').Router();
const validate = require('../middleware/validate');
const authController = require('../controllers/authController');

router.post(
  '/register',
  validate({
    name: 'required',
    email: 'required|email',
    password: 'required|min:6',
    role: 'required|in:ambulance,police'
  }),
  authController.register
);

router.post(
  '/login',
  validate({
    email: 'required|email',
    password: 'required'
  }),
  authController.login
);

module.exports = router;
