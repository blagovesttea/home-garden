module.exports = function adminOnly(req, res, next) {
  try {
    // auth middleware трябва да е минал преди това
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized (no user)" });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }

    next();
  } catch (e) {
    return res.status(500).json({ message: "Admin check error" });
  }
};
