const jwt = require("jsonwebtoken");

module.exports = function auth(req, res, next) {
  try {
    // ✅ JWT_SECRET check (важно за production)
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "JWT_SECRET липсва в env",
      });
    }

    // Authorization: Bearer <token>
    const header = req.headers.authorization || req.headers.Authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Запазваме само това, което ни трябва
    req.user = {
      id: payload.id,
      role: payload.role,
    };

    next();
  } catch (e) {
    if (e.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }

    return res.status(401).json({ message: "Invalid token" });
  }
};
