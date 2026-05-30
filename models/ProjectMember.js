// models/ProjectMember.js
module.exports = (sequelize, DataTypes) => {
  const ProjectMember = sequelize.define("ProjectMember", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    role: {
      type: DataTypes.ENUM("owner", "member"),
      defaultValue: "member",
    },
  });

  return ProjectMember;
};

