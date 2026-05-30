const {
  User,
  Project,
  ProjectMember,
  InviteToken,
} = require("../../models");

const crypto = require("crypto");

// Create project
const createProject = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    const project = await Project.create({
      name,
      ownerId: userId,
    });

    await ProjectMember.create({
      userId,
      projectId: project.id,
      role: "owner",
    });

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

// Get user projects
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

// Get single project
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

// Invite member
const inviteMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, email } = req.body;

    const membership = await ProjectMember.findOne({
      where: { projectId, userId, role: "owner" },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "Only project owners can invite members",
      });
    }

    const invitedUser = await User.findOne({ where: { email } });

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
      email,
      token,
      expiresAt,
      usedAt: null,
    });

    return res.status(201).json({
      success: true,
      inviteToken: token,
      expiresAt,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to create invite",
    });
  }
};

// Get project members (normalized)
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

// Accept invite
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

    await ProjectMember.create({
      userId,
      projectId: invite.projectId,
      role: "member",
    });

    await invite.update({
      usedAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "Successfully joined project",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to accept invite",
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
};