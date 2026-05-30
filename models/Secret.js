// models/Secret.js
module.exports = (sequelize, DataTypes) => {
  const Secret = sequelize.define("Secret", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    ciphertext: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    iv: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    tag: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  return Secret;
};