const express = require("express");
const Product = require("../models/Product");

const router = express.Router();

/** ✅ Public base filter:
 * - only approved
 * - allow bg.foundInBG: "unknown" OR "no" (and also missing field)
 */
function publicMatch() {
  return {
    status: "approved",
    $or: [
      { "bg.foundInBG": { $in: ["unknown", "no"] } },
      { "bg.foundInBG": { $exists: false } },
      { bg: { $exists: false } },
    ],
  };
}

/**
 * ✅ Map legacy single category -> catalog path
 * (докато мигрираме всички продукти да имат categoryPath)
 */
function legacyToCatalogPath(cat) {
  const c = String(cat || "").trim().toLowerCase();
  if (!c || c === "all") return null;

  // allow "home/kitchen/cookware"
  if (c.includes("/")) return c.split("/").filter(Boolean);

  // legacy buckets
  if (["home", "garden", "tools", "outdoor", "kitchen", "storage"].includes(c)) return [c];

  // unknown
  return [c];
}

/**
 * Build category filter:
 * - If we have categoryPath in products: use it
 * - Fallback: legacy category
 *
 * Supports:
 * ?category=home
 * ?category=home/kitchen/cookware
 * ?category=kitchen
 */
function applyCategoryFilter(filter, category) {
  const path = legacyToCatalogPath(category);
  if (!path || !path.length) return;

  // Mongo: match by "all elements present" (prefix-like)
  // For prefix semantics: we want categoryPath starting with path.
  // We can use $expr + $slice, but to keep it simple & fast:
  // - for root: categoryPath contains root slug
  // - for deeper: categoryPath contains all slugs in path (works ok), plus prefer exact prefix later.
  //
  // We'll do a pragmatic approach:
  // 1) Try to match by prefix using $expr (works on Mongo 4.0+).
  // 2) Fallback to $all if needed (but we keep both in $or).
  const prefixExpr = {
    $expr: {
      $eq: [
        { $slice: ["$categoryPath", path.length] },
        path,
      ],
    },
  };

  const allMatch = { categoryPath: { $all: path } };

  // Legacy fallback: if products still have no categoryPath
  const legacyFallback =
    path.length === 1
      ? { category: path[0] }
      : null;

  filter.$and = filter.$and || [];
  filter.$and.push({
    $or: [
      // catalog match
      prefixExpr,
      allMatch,
      // legacy match
      ...(legacyFallback ? [legacyFallback] : []),
    ],
  });
}

/**
 * ✅ TOP products
 * GET /products/top
 *
 * Query:
 * ?by=clicks   (default)
 * ?by=ctr      (clicks/views)
 * ?by=profitScore
 * ?limit=20
 */
router.get("/top", async (req, res) => {
  try {
    const by = String(req.query.by || "clicks").toLowerCase();
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const baseMatch = publicMatch();

    if (by === "ctr") {
      const items = await Product.aggregate([
        { $match: baseMatch },
        {
          $addFields: {
            ctr: {
              $cond: [{ $gt: ["$views", 0] }, { $divide: ["$clicks", "$views"] }, 0],
            },
          },
        },
        { $sort: { ctr: -1, clicks: -1, views: -1, createdAt: -1 } },
        { $limit: limit },
      ]);
      return res.json({ ok: true, by: "ctr", limit, items });
    }

    if (by === "profitscore" || by === "profitScore".toLowerCase()) {
      const items = await Product.find(baseMatch)
        .sort({ profitScore: -1, score: -1, clicks: -1, views: -1, createdAt: -1 })
        .limit(limit);

      return res.json({ ok: true, by: "profitScore", limit, items });
    }

    // default: clicks
    const items = await Product.find(baseMatch)
      .sort({ clicks: -1, views: -1, createdAt: -1 })
      .limit(limit);

    return res.json({ ok: true, by: "clicks", limit, items });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * ✅ Public products
 * GET /products
 *
 * Query params:
 * ?page=1
 * ?limit=20
 * ?q=search text
 * ?category=home
 * ?category=home/kitchen/cookware
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const { q, category } = req.query || {};

    const filter = publicMatch();

    if (q) filter.title = { $regex: q, $options: "i" };

    // ✅ Catalog category support + legacy fallback
    if (category && category !== "all") applyCategoryFilter(filter, category);

    const items = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(filter);

    return res.json({ ok: true, page, limit, total, items });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * ✅ Product details
 * GET /products/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const item = await Product.findOne({
      _id: req.params.id,
      ...publicMatch(),
    });

    if (!item) return res.status(404).json({ message: "Not found" });
    return res.json({ ok: true, item });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * GET /products/:id/view
 */
router.get("/:id/view", async (req, res) => {
  try {
    const item = await Product.findOneAndUpdate(
      { _id: req.params.id, ...publicMatch() },
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!item) return res.status(404).json({ message: "Not found" });
    return res.json({ ok: true, views: item.views });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * GET /products/:id/click
 */
router.get("/:id/click", async (req, res) => {
  try {
    const item = await Product.findOneAndUpdate(
      { _id: req.params.id, ...publicMatch() },
      { $inc: { clicks: 1 } },
      { new: true }
    );

    if (!item) return res.status(404).json({ message: "Not found" });

    const target =
      (item.affiliateUrl && String(item.affiliateUrl).trim()) ||
      (item.sourceUrl && String(item.sourceUrl).trim());

    if (!target) return res.status(400).json({ message: "No target url" });

    return res.redirect(target);
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
