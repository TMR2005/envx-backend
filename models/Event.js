// models/Event.js
module.exports = (sequelize, DataTypes) => {
  const Event = sequelize.define("Event", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "user_id",
    },

    eventType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "event_type",
    },

    projectId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "project_id",
    },

    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      field: "metadata",
    },
  }, {
    tableName: "events",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false, // Event tracking logs are append-only; updates are disabled
  });

  return Event;
};
