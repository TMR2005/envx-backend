const { User, Project, ProjectMember, InviteToken, sequelize } = require("../../models");
const crypto = require("crypto");
const { trackEvent, trackFunnelStep } = require("../lib/analytics");
const { QueryTypes } = require("sequelize");

const createProject = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    // Restrict maximum project creation count to 3 per user
    const projectCount = await Project.count({
      where: { ownerId: userId }
    });

    if (projectCount >= 3) {
      return res.status(400).json({
        success: false,
        message: "You have reached the maximum limit of 3 projects.",
      });
    }

    const project = await Project.create({
      name,
      ownerId: userId,
    });

    await ProjectMember.create({
      userId,
      projectId: project.id,
      role: "owner",
    });

    // Track project creation (Funnel Stage 2)
    trackEvent(userId, "create_project", project.id, {
      project_name: name,
      source: req.headers["user-agent"]?.includes("node") ? "cli" : "web"
    }).catch(console.error);
    trackFunnelStep(userId, "create_project", 2).catch(console.error);

    return res.status(201).json({
      success: true,
      project,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to create project",
    });
  }
};

const getProjects = async (req, res) => {
  try {
    const userId = req.user.id;

    const projects = await Project.findAll({
      include: [
        {
          model: ProjectMember,
          where: { userId },
          attributes: ["role"],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      projects,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
    });
  }
};

const getProjectById = async (req, res) => {
  try {
    const userId = req.user.id;
    const projectId = req.params.id;

    const project = await Project.findOne({
      where: { id: projectId },
      include: [
        {
          model: ProjectMember,
          where: { userId },
          attributes: ["role"],
        },
      ],
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or access denied",
      });
    }

    return res.status(200).json({
      success: true,
      project,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch project",
    });
  }
};

const inviteMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, username } = req.body;

    const membership = await ProjectMember.findOne({
      where: { projectId, userId, role: "owner" },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "Only project owners can invite members",
      });
    }

    // Restrict maximum project member count to 10
    const currentMemberCount = await ProjectMember.count({
      where: { projectId }
    });

    if (currentMemberCount >= 10) {
      return res.status(400).json({
        success: false,
        message: "This project has reached the maximum limit of 10 team members.",
      });
    }

    const invitedUser = await User.findOne({ where: { username } });

    if (invitedUser) {
      const existingMember = await ProjectMember.findOne({
        where: { projectId, userId: invitedUser.id },
      });

      if (existingMember) {
        return res.status(400).json({
          success: false,
          message: "User is already a member",
        });
      }
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await InviteToken.create({
      projectId,
      username,
      token,
      expiresAt,
      usedAt: null,
    });

    // Track teammate invitation (Funnel Stage 4)
    trackEvent(userId, "invite", projectId, {
      invited_user: username,
      source: req.headers["user-agent"]?.includes("node") ? "cli" : "web"
    }).catch(console.error);
    trackFunnelStep(userId, "invite_user", 4).catch(console.error);

    const project = await Project.findByPk(projectId);
    const memberCount = await ProjectMember.count({ where: { projectId } });

    return res.status(201).json({
      success: true,
      inviteToken: token,
      expiresAt,
      projectName: project ? project.name : "Untitled project",
      memberCount
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to create invite",
    });
  }
};

const getProjectMembers = async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.id;

    const membership = await ProjectMember.findOne({
      where: { projectId, userId },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const members = await ProjectMember.findAll({
      where: { projectId },
      include: [
        {
          model: User,
          attributes: ["id", "email", "username"],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        user: m.User,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch members",
    });
  }
};

const acceptInvite = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    const invite = await InviteToken.findOne({
      where: { token },
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: "Invalid invite token",
      });
    }

    if (invite.usedAt) {
      return res.status(400).json({
        success: false,
        message: "Invite already used",
      });
    }

    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "Invite expired",
      });
    }

    const existingMember = await ProjectMember.findOne({
      where: {
        userId,
        projectId: invite.projectId,
      },
    });

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: "Already a member of this project",
      });
    }

    // Restrict maximum project member count to 10 on acceptance
    const currentMemberCount = await ProjectMember.count({
      where: { projectId: invite.projectId }
    });

    if (currentMemberCount >= 10) {
      return res.status(400).json({
        success: false,
        message: "This project has reached the maximum limit of 10 team members.",
      });
    }

    await ProjectMember.create({
      userId,
      projectId: invite.projectId,
      role: "member",
    });

    await invite.update({
      usedAt: new Date(),
    });

    // Track project join (Funnel Stage 5)
    trackEvent(userId, "join", invite.projectId, {
      invite_token_used: true,
      source: req.headers["user-agent"]?.includes("node") ? "cli" : "web"
    }).catch(console.error);
    trackFunnelStep(userId, "join_team", 5).catch(console.error);

    const project = await Project.findByPk(invite.projectId);
    const memberCount = await ProjectMember.count({ where: { projectId: invite.projectId } });

    return res.status(200).json({
      success: true,
      message: "Successfully joined project",
      projectName: project ? project.name : "Untitled project",
      memberCount
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to accept invite",
    });
  }
};


const getProjectAuditLogs = async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.id;

    const membership = await ProjectMember.findOne({
      where: { projectId, userId },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const logs = await sequelize.query(
      `SELECT 
        e.id,
        e.event_type,
        e.metadata,
        e.created_at::text as created_at,
        u.username,
        u.email,
        u."avatarUrl" as "avatarUrl"
       FROM events e
       LEFT JOIN "Users" u ON e.user_id = u.id
       WHERE e.project_id = :projectId
       ORDER BY e.created_at DESC
       LIMIT 100`,
      {
        replacements: { projectId },
        type: QueryTypes.SELECT
      }
    );

    return res.status(200).json({
      success: true,
      logs
    });
  } catch (error) {
    console.error("❌ Failed to fetch project audit logs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch audit logs"
    });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  inviteMember,
  getProjectMembers,
  acceptInvite,
  getProjectAuditLogs,
};