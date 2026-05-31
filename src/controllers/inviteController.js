const {
  User,
  Project,
  ProjectMember,
  InviteToken,
} = require("../../models");

const getUserInvites = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const invites = await InviteToken.findAll({
      where: {
        username: user.username,
        usedAt: null,
      },
    });

    const validInvites = invites.filter(
      (invite) => new Date(invite.expiresAt).getTime() > Date.now()
    );

    const invitesWithProjects = await Promise.all(
      validInvites.map(async (invite) => {
        const project = await Project.findByPk(invite.projectId);
        return {
          token: invite.token,
          projectName: project ? project.name : "Unknown Project",
          username: invite.username,
        };
      })
    );

    return res.status(200).json({
      success: true,
      invites: invitesWithProjects,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch invites",
    });
  }
};

module.exports = {
  getUserInvites, 
};