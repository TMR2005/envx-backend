const {
  sequelize,
  User,
  Project,
  ProjectMember,
} = require("../models");

async function main() {
  await sequelize.authenticate();
  console.log("✅ DB connected");

  const user = await User.create({
    username: "praveentmr",
    email: "praveen@test.com",
    githubId: "12345",
    name: "Praveen",
  });

  const project = await Project.create({
    name: "envx-demo",
    ownerId: user.id,
  });

  await ProjectMember.create({
    userId: user.id,
    projectId: project.id,
    role: "owner",
  });

  console.log("User:", user.id);
  console.log("Project:", project.id);
}

main()
  .then(() => sequelize.close())
  .catch((err) => {
    console.error(err);
    sequelize.close();
  });