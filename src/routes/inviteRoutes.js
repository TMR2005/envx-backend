// Project routes definition
const auth = require('../middleware/auth');

const express = require('express');
const router = express.Router();

// Controller functions
const {
    getUserInvites
} = require('../controllers/inviteController');

// Routes
router.get('/', auth, getUserInvites);

module.exports = router;
