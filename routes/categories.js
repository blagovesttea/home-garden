// routes/categories.js
const express = require("express");
const Category = require("../models/Category");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");

const router = express.Router();

function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * ✅ SEED categories (admin only)
 * POST /categories/seed
 */
router.post("/seed", auth, adminOnly, async (req, res) => {
  try {
    // Big, realistic Home & Garden catalog (can extend later)
    const seed = [
      {
        name: "Home",
        children: [
          {
            name: "Kitchen",
            children: [
              { name: "Cookware" },
              { name: "Bakeware" },
              { name: "Knives" },
              { name: "Small Appliances" },
              { name: "Kitchen Storage" },
              { name: "Dish & Table" },
              { name: "Coffee & Tea" },
            ],
          },
          {
            name: "Cleaning",
            children: [
              { name: "Cleaning Tools" },
              { name: "Laundry" },
              { name: "Bathroom Cleaning" },
              { name: "Floor Care" },
            ],
          },
          {
            name: "Storage",
            children: [
              { name: "Wardrobe" },
              { name: "Shelving" },
              { name: "Boxes & Bins" },
              { name: "Organizers" },
              { name: "Hooks & Hangers" },
            ],
          },
          {
            name: "Bathroom",
            children: [
              { name: "Bathroom Accessories" },
              { name: "Shower" },
              { name: "Towels & Rugs" },
              { name: "Toilet Accessories" },
            ],
          },
          {
            name: "Bedroom",
            children: [
              { name: "Bedding" },
              { name: "Pillows" },
              { name: "Blankets" },
              { name: "Closet Organizers" },
            ],
          },
          {
            name: "Living Room",
            children: [
              { name: "Decor" },
              { name: "Lighting" },
              { name: "Rugs" },
              { name: "Curtains" },
              { name: "Shelves & Stands" },
            ],
          },
          {
            name: "Home Office",
            children: [
              { name: "Desk Accessories" },
              { name: "Cable Management" },
              { name: "Organizers" },
            ],
          },
          {
            name: "Pets",
            children: [
              { name: "Pet Supplies" },
              { name: "Pet Grooming" },
              { name: "Pet Beds" },
            ],
          },
        ],
      },
      {
        name: "Garden",
        children: [
          {
            name: "Tools",
            children: [
              { name: "Hand Tools" },
              { name: "Power Tools" },
              { name: "Pruners & Shears" },
            ],
          },
          {
            name: "Watering",
            children: [
              { name: "Hoses" },
              { name: "Sprinklers" },
              { name: "Irrigation" },
              { name: "Watering Cans" },
            ],
          },
          {
            name: "Outdoor",
            children: [
              { name: "Outdoor Lighting" },
              { name: "Camping" },
              { name: "BBQ & Grilling" },
              { name: "Outdoor Furniture" },
            ],
          },
          {
            name: "Plants",
            children: [
              { name: "Planters & Pots" },
              { name: "Soil & Fertilizers" },
              { name: "Seeds" },
              { name: "Greenhouse" },
            ],
          },
          {
            name: "Pest Control",
            children: [
              { name: "Insect Control" },
              { name: "Rodent Control" },
              { name: "Repellents" },
            ],
          },
        ],
      },
    ];

    async function upsertNode(node, parentDoc, order) {
      const name = String(node.name || "").trim();
      const slug = slugify(name) || slugify(String(order)) || "cat";

      const parentId = parentDoc ? parentDoc._id : null;
      const level = parentDoc ? Number(parentDoc.level || 0) + 1 : 0;
      const parentPath = parentDoc ? Array.isArray(parentDoc.path) ? parentDoc.path : [] : [];
      const path = [...parentPath, slug];

      const doc = await Category.findOneAndUpdate(
        { parent: parentId, slug },
        {
          $set: {
            name,
            slug,
            parent: parentId,
            level,
            order: Number(order || 0),
            isActive: true,
            path,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const kids = Array.isArray(node.children) ? node.children : [];
      for (let i = 0; i < kids.length; i++) {
        await upsertNode(kids[i], doc, i);
      }
      return doc;
    }

    for (let i = 0; i < seed.length; i++) {
      await upsertNode(seed[i], null, i);
    }

    const count = await Category.countDocuments({});
    return res.json({ ok: true, message: "Categories seeded", count });
  } catch (err) {
    return res.status(500).json({ message: "Seed error", error: err.message });
  }
});

/**
 * GET /categories
 * Tree structure for menu:
 * [
 *   { name, slug, path, children:[...] }
 * ]
 */
router.get("/", async (req, res) => {
  try {
    const items = await Category.find({ isActive: true })
      .sort({ level: 1, order: 1, name: 1 })
      .lean();

    const byId = new Map();
    const roots = [];

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
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * GET /categories/flat
 * Flat list for dropdowns
 */
router.get("/flat", async (req, res) => {
  try {
    const items = await Category.find({ isActive: true })
      .sort({ level: 1, order: 1, name: 1 })
      .lean();

    return res.json({ ok: true, items });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * ✅ Express 5 safe wildcard param
 * GET /categories/by-path/:path(*)
 * Example: /categories/by-path/home/kitchen/cookware
 */
router.get("/by-path/:path(*)", async (req, res) => {
  try {
    const pathStr = req.params.path;
    if (!pathStr) return res.status(400).json({ message: "Path required" });

    const pathArr = pathStr
      .split("/")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const item = await Category.findOne({ path: pathArr, isActive: true }).lean();
    if (!item) return res.status(404).json({ message: "Category not found" });

    return res.json({ ok: true, item });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
