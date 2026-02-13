const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();

/**
 * Password rules:
 * - min 8 chars
 * - at least 1 uppercase
 * - at least 1 lowercase
 * - at least 1 digit
 */
const PASS_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email и парола са задължителни." });
    }

    if (!PASS_RE.test(password)) {
      return res.status(400).json({
        message:
          "Паролата трябва да е минимум 8 символа и да съдържа поне 1 главна буква, 1 малка буква и 1 цифра.",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ message: "Този email вече е регистриран." });
    }

    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email: normalizedEmail,
      password: hash,
      role: "user",
    });

    return res.status(201).json({
      message: "Регистрацията е успешна.",
      user: { id: user._id, email: user.email, role: user.role },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email и парола са задължителни." });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: "Грешен email или парола." });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Грешен email или парола." });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "JWT_SECRET липсва в .env" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Login OK",
      token,
      user: { id: user._id, email: user.email, role: user.role },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/** current user by token */
router.get("/me", auth, async (req, res) => {
  return res.json({ ok: true, user: req.user }); // { id, role, iat, exp }
});

/**
 * ✅ TEMP: make current user admin (use once, then delete this route)
 * Requires Bearer token.
 */
router.post("/make-admin", auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ message: "User not found" });

    me.role = "admin";
    await me.save();

    return res.json({ ok: true, message: "You are admin now" });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
