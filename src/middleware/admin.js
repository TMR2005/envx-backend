// server/src/middleware/admin.js
// Restricts endpoints to authorized administrator accounts

const requireAdmin = (req, res, next) => {
  try {
    const adminUsernames = (process.env.ADMIN_USERNAMES || 'praveentmr,TMR2005')
      .split(',')
      .map(username => username.trim().toLowerCase());

    if (req.user && adminUsernames.includes(req.user.username.toLowerCase())) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Administrative access required",
      });
    }
  } catch (error) {
    console.error('❌ Require admin middleware error:', error);
    return res.status(500).json({
      success: false,
      message: "Internal server error verifying authorization",
    });
  }
};

module.exports = requireAdmin;
