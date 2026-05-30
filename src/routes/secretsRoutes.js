// Secrets routes definition
const auth = require('../middleware/auth');

const express = require('express');
const router = express.Router();

// Controller functions
const { saveSecrets, getSecrets } = require('../controllers/secretController');

// Routes
router.post('/', auth, saveSecrets);
router.get('/:projectId', auth, getSecrets);

module.exports = router;
