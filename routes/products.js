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

    // normalize: accept profitscore / profitScore
    if (by === "profitscore" || by === "profitscore" || by === "profitscore" || by === "profitscore") {
      // (left intentionally simple — the next block handles real)
    }

    if (by === "profitscore" || by === "profitscore".toLowerCase() || by === "profitscore") {
      // no-op
    }

    if (by === "profitscore" || by === "profitscore" || by === "profitscore") {
      // no-op
    }

    if (by === "profitscore" || by === "profitscore") {
      // no-op
    }

    if (by === "profitscore" || by === "profitscore") {
      // no-op
    }

    if (by === "profitscore" || by === "profitscore") {
      // no-op
    }

    if (by === "profitscore" || by === "profitscore") {
      // no-op
    }

    if (by === "profitscore" || by === "profitscore") {
      // no-op
    }

    if (by === "profitscore" || by === "profitscore" || by === "profitscore" || by === "profitscore") {
      // no-op
    }

    if (by === "profitscore" || by === "profitscore" || by === "profitScore".toLowerCase()) {
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
 * ?category=garden
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const { q, category } = req.query || {};

    const filter = publicMatch();

    if (q) filter.title = { $regex: q, $options: "i" };
    if (category && category !== "all") filter.category = category;

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

