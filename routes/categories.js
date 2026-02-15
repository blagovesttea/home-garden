const express = require("express");
const Category = require("../models/Category");

const router = express.Router();

/**
 * GET /categories
 * Tree structure for menu:
 * [
 *   {
 *     name,
 *     slug,
 *     path,
 *     children: [...]
 *   }
 * ]
 */
router.get("/", async (req, res) => {
  try {
    const items = await Category.find({ isActive: true })
      .sort({ level: 1, order: 1, name: 1 })
      .lean();

    const byId = new Map();
    const roots = [];

    // prepare nodes
    for (const c of items) {
      byId.set(String(c._id), {
        _id: c._id,
        name: c.name,
        slug: c.slug,
        path: c.path || [],
        level: c.level,
        parent: c.parent || null,
        children: [],
      });
    }

    // build tree
    for (const c of items) {
      const node = byId.get(String(c._id));

      if (c.parent) {
        const parent = byId.get(String(c.parent));
        if (parent) parent.children.push(node);
        else roots.push(node);
      } else {
        roots.push(node);
      }
    }

    return res.json({ ok: true, items: roots });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});

/**
 * GET /categories/flat
 * Flat list for admin dropdowns
 */
router.get("/flat", async (req, res) => {
  try {
    const items = await Category.find({ isActive: true })
      .sort({ level: 1, order: 1, name: 1 })
      .lean();

    return res.json({ ok: true, items });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});

/**
 * GET /categories/by-path/:path
 * Example:
 * /categories/by-path/home
 * /categories/by-path/home/kitchen
 * /categories/by-path/home/kitchen/cookware
 */
router.get("/by-path/*", async (req, res) => {
  try {
    const pathStr = req.params[0];
    if (!pathStr) {
      return res.status(400).json({ message: "Path required" });
    }

    const pathArr = pathStr
      .split("/")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const item = await Category.findOne({
      path: pathArr,
      isActive: true,
    }).lean();

    if (!item) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.json({ ok: true, item });
  } catch (err) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});

module.exports = router;
