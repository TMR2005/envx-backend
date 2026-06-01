// Project routes definition
const auth = require('../middleware/auth');

const express = require('express');
const router = express.Router();

// Controller functions
const {
  createProject,
  getProjects,
  getProjectById,
  inviteMember,
  getProjectMembers,
  acceptInvite,
  getProjectAuditLogs,
} = require('../controllers/projectController');

// Routes
router.post('/', auth, createProject);
router.get('/', auth, getProjects);
router.get('/:id', auth, getProjectById);
router.post('/invite', auth, inviteMember);
router.get('/:id/members', auth, getProjectMembers);
router.post('/accept-invite', auth, acceptInvite);
router.get('/:id/audit-logs', auth, getProjectAuditLogs);

module.exports = router;
