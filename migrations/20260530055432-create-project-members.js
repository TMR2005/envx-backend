module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ProjectMembers", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },

      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onDelete: "CASCADE",
      },

      projectId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Projects",
          key: "id",
        },
        onDelete: "CASCADE",
      },

      role: {
        type: Sequelize.ENUM("owner", "admin", "member"),
        allowNull: false,
        defaultValue: "member",
      },

      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW"),
      },

      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.addConstraint("ProjectMembers", {
      fields: ["userId", "projectId"],
      type: "unique",
      name: "unique_project_member",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("ProjectMembers");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_ProjectMembers_role";'
    );
  },
};