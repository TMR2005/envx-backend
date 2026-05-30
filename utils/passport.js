const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const { User } = require("../models");

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const [user] = await User.findOrCreate({
          where: {
            githubId: profile.id.toString(),
          },
          defaults: {
            username: profile.username,
            email:
              profile.emails?.[0]?.value ||
              `${profile.username}@github.local`,
            avatarUrl: profile.photos?.[0]?.value,
          },
        });

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);