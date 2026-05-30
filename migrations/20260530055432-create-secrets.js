module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Secrets", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },

      projectId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: "Projects",
          key: "id",
        },
        onDelete: "CASCADE",
      },

      ciphertext: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      iv: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      tag: {
        type: Sequelize.STRING,
        allowNull: false,
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable("Secrets");
  },
};