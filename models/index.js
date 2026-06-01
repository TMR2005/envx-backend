const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = require("./User")(sequelize, DataTypes);
const Project = require("./Project")(sequelize, DataTypes);
const ProjectMember = require("./ProjectMember")(sequelize, DataTypes);
const InviteToken = require("./InviteToken")(sequelize, DataTypes);
const Secret = require("./Secret")(sequelize, DataTypes);
const Event = require("./Event")(sequelize, DataTypes);

/* =========================
   ASSOCIATIONS
========================= */

// Project ↔ ProjectMember
Project.hasMany(ProjectMember, { foreignKey: "projectId" });
ProjectMember.belongsTo(Project, { foreignKey: "projectId" });

// User ↔ ProjectMember
User.hasMany(ProjectMember, { foreignKey: "userId" });
ProjectMember.belongsTo(User, { foreignKey: "userId" });

// Project ↔ Secret
Project.hasOne(Secret, { foreignKey: "projectId" });
Secret.belongsTo(Project, { foreignKey: "projectId" });

// Project ↔ InviteToken
Project.hasMany(InviteToken, { foreignKey: "projectId" });
InviteToken.belongsTo(Project, { foreignKey: "projectId" });

// User ↔ Event
User.hasMany(Event, { foreignKey: "userId" });
Event.belongsTo(User, { foreignKey: "userId", as: "user" });

// Project ↔ Event
Project.hasMany(Event, { foreignKey: "projectId" });
Event.belongsTo(Project, { foreignKey: "projectId", as: "project" });

module.exports = {
  sequelize,
  Sequelize,
  User,
  Project,
  ProjectMember,
  InviteToken,
  Secret,
  Event,
};