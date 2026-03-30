const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();

/**
 * Правила за парола:
 * - минимум 8 символа
 * - поне 1 главна буква
 * - поне 1 малка буква
 * - поне 1 цифра
 */
const PASS_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

function signToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET липсва в .env");
  }

  return jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        message: "Имейлът и паролата са задължителни.",
      });
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
      return res.status(409).json({
        message: "Този имейл вече е регистриран.",
      });
    }

    const hash = await bcrypt.hash(password, 12);

    const user = await User.create({
      email: normalizedEmail,
      password: hash,
      role: "user",
    });

    return res.status(201).json({
      ok: true,
      message: "Регистрацията е успешна.",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Грешка в сървъра.",
      error: err.message,
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        message: "Имейлът и паролата са задължителни.",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        message: "Грешен имейл или парола.",
      });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({
        message: "Грешен имейл или парола.",
      });
    }

    const token = signToken(user);

    return res.json({
      ok: true,
      message: "Входът е успешен.",
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Грешка в сървъра.",
      error: err.message,
    });
  }
});

/**
 * Текущ потребител по токен
 */
router.get("/me", auth, async (req, res) => {
  return res.json({
    ok: true,
    user: req.user,
  });
});

/**
 * Прави текущия потребител админ
 * Изисква:
 * - Bearer token
 * - ADMIN_MAKE_KEY в env
 * - header: x-admin-make-key: <ADMIN_MAKE_KEY>
 *
 * Връща нов токен с обновена роля
 */
router.post("/make-admin", auth, async (req, res) => {
  try {
    const expected = process.env.ADMIN_MAKE_KEY;

    if (!expected) {
      return res.status(500).json({
        message: "ADMIN_MAKE_KEY липсва в env.",
      });
    }

    const provided = req.header("x-admin-make-key");
    if (!provided || provided !== expected) {
      return res.status(403).json({
        message: "Нямаш достъп до тази функция.",
      });
    }

    const me = await User.findById(req.user.id);
    if (!me) {
      return res.status(404).json({
        message: "Потребителят не е намерен.",
      });
    }

    if (me.role !== "admin") {
      me.role = "admin";
      await me.save();
    }

    const token = signToken(me);

    return res.json({
      ok: true,
      message: "Потребителят вече е администратор.",
      token,
      user: {
        id: me._id,
        email: me.email,
        role: me.role,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Грешка в сървъра.",
      error: err.message,
    });
  }
});

module.exports = router;