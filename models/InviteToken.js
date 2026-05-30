// models/InviteToken.js
module.exports = (sequelize, DataTypes) => {
  const InviteToken = sequelize.define("InviteToken", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    token: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },

    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    used: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  });

  return InviteToken;
};