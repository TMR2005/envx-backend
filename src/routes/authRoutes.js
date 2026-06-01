const express = require("express");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");
const { trackEvent, trackFunnelStep } = require("../lib/analytics");

// GitHub OAuth initiation
router.get("/github", (req, res, next) => {
  const state = req.query.state; // CLI or frontend callback target

  if (!state) {
    return res.status(400).json({
      success: false,
      message: "Missing state parameter",
    });
  }

  passport.authenticate("github", {
    scope: ["user:email"],
    state,
  })(req, res, next);
});

// GitHub OAuth callback
router.get(
  "/github/callback",
  passport.authenticate("github", { session: false }),
  async (req, res) => {
    const state = req.query.state;

    const token = jwt.sign(
      { id: req.user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Track login and signup stage 1 asynchronously
    trackEvent(req.user.id, "login", null, { github_username: req.user.username }).catch(console.error);
    trackFunnelStep(req.user.id, "signup", 1).catch(console.error);

    // CLI FLOW → redirect to localhost callback
    if (state && state.startsWith("cli:")) {
      const callbackUrl = state.replace("cli:", "");
      return res.redirect(`${callbackUrl}?token=${token}`);
    }

    // FRONTEND FLOW
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/success?token=${token}`;
    res.redirect(redirectUrl);
  }
);

module.exports = router;