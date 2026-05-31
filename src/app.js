// Load environment variables right at the top
require("dotenv").config(); 

const express = require("express");
const passport = require("passport");
const cors = require("cors");

const { sequelize } = require("../models");

require("../utils/passport");

const projectsRouter = require("./routes/projectRoutes");
const secretsRouter = require("./routes/secretsRoutes");
const authRouter = require("./routes/authRoutes");
const inviteRouter = require("./routes/inviteRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Dynamically pull the frontend URL from your environment variables
const allowedOrigins = [
  "http://localhost:8080",
  process.env.FRONTEND_URL
].filter(Boolean); // filter(Boolean) safely ignores the variable if it isn't set locally

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.options(/.*/, cors());

app.use(express.json());
app.use(passport.initialize());

// Connect and sync tables to Neon Postgres
sequelize
  .authenticate()
  .then(() => {
    console.log("✅ Database connection established");
    return sequelize.sync({ alter: true }); 
  })
  .then(() => console.log("✅ Tables synchronized"))
  .catch((err) => {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  });

app.get("/", (req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/secrets", secretsRouter);
app.use("/api/invites", inviteRouter);

app.use(errorHandler);

module.exports = app;