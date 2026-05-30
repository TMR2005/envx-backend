// requireOwner middleware – ensures the authenticated user is the owner of the project
const { ProjectMember } = require("../../models");

module.exports = async (req, res, next) => {
  try {
    const projectId = req.body.projectId || req.params.projectId || req.params.id;
    const userId = req.user.id;
    const membership = await ProjectMember.findOne({
      where: { projectId, userId, role: "owner" },
    });
    if (!membership) {
      return res.status(403).json({ success: false, message: "Owner access required" });
    }
    next();
  } catch (error) {
    next(error);
  }
};
