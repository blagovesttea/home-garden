const express = require("express");
const Product = require("../models/Product");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");

const router = express.Router();

const ALLOWED_STATUS = ["new", "approved", "rejected", "blacklisted"];
const AFF_TAG = process.env.AFF_TAG || "homegarden";

/** helpers */
function buildAffiliateUrl(sourceUrl) {
  const u = String(sourceUrl || "").trim();
  if (!u) return "";

  // ако вече има ref=, не добавяме втори път
  if (/[?&]ref=/.test(u)) return u;

  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}ref=${encodeURIComponent(AFF_TAG)}`;
}

function toSafeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function computeProfitScore(p) {
  // MVP formula
  let ps = 0;

  const score = toSafeNumber(p.score, 0);
  ps += score;

  if (p.affiliateUrl && String(p.affiliateUrl).trim()) ps += 2;

  const price = toSafeNumber(p.price, NaN);
  if (!Number.isNaN(price) && price <= 30) ps += 1;

  const shippingDays =
    p.shippingDays == null ? null : toSafeNumber(p.shippingDays, NaN);
  if (
    shippingDays != null &&
    !Number.isNaN(shippingDays) &&
    shippingDays <= 10
  )
    ps += 1;

  if (p.shippingToBG === false) ps -= 1;

  return ps;
}

/**
 * POST /admin/products
 * Create product (admin only)
 */
router.post("/products", auth, adminOnly, async (req, res) => {
  try {
    const data = req.body || {};
    const { title, source, sourceUrl, price } = data;

    if (!title || !source || !sourceUrl || price == null) {
      return res.status(400).json({
        message: "Required: title, source, sourceUrl, price",
      });
    }

    const normalizedSourceUrl = String(sourceUrl).trim();

    const affiliateUrl =
      (data.affiliateUrl && String(data.affiliateUrl).trim()) ||
      buildAffiliateUrl(normalizedSourceUrl);

    const priceNum = toSafeNumber(price, NaN);
    if (Number.isNaN(priceNum)) {
      return res.status(400).json({ message: "Invalid price" });
    }

    const profitScore = computeProfitScore({
      ...data,
      affiliateUrl,
      price: priceNum,
    });

    const payload = {
      ...data,
      title: String(title).trim(),
      source: String(source).trim(),
      sourceUrl: normalizedSourceUrl,
      affiliateUrl,
      price: priceNum,
      profitScore,
      createdBy: req.user.id,
    };

    const product = await Product.create(payload);
    return res.status(201).json({ ok: true, product });
  } catch (err) {
    if (err && err.code === 11000) {
      return res
        .status(409)
        .json({ message: "Product already exists (duplicate sourceUrl)" });
    }
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
});

/**
 * ✅ POST /admin/products/seed
 * Seed demo products that WILL SHOW in public:
 * - status="approved"
 * - bg.foundInBG="no"
 */
router.post("/products/seed", auth, adminOnly, async (req, res) => {
  try {
    const demo = [
      {
        title: "LED Solar Garden Lights (4 pcs)",
        category: "garden",
        source: "aliexpress",
        sourceUrl: "https://example.com/solar-lights",
        price: 12.9,
        currency: "EUR",
        shippingDays: 7,
        shippingToBG: true,
        imageUrl: "https://picsum.photos/600?seed=hg1",
        status: "approved",
        score: 6,
        bg: { foundInBG: "no" },
      },
      {
        title: "Wall Mounted Kitchen Organizer",
        category: "kitchen",
        source: "temu",
        sourceUrl: "https://example.com/kitchen-organizer",
        price: 9.5,
        currency: "EUR",
        shippingDays: 5,
        shippingToBG: true,
        imageUrl: "https://picsum.photos/600?seed=hg2",
        status: "approved",
        score: 7,
        bg: { foundInBG: "no" },
      },
      {
        title: "Cordless Mini Drill Set",
        category: "tools",
        source: "amazon_de",
        sourceUrl: "https://example.com/mini-drill",
        price: 29.9,
        currency: "EUR",
        shippingDays: 4,
        shippingToBG: true,
        imageUrl: "https://picsum.photos/600?seed=hg3",
        status: "approved",
        score: 8,
        bg: { foundInBG: "no" },
      },
      {
        title: "Foldable Storage Boxes (3 pcs)",
        category: "storage",
        source: "temu",
        sourceUrl: "https://example.com/storage-boxes",
        price: 14.2,
        currency: "EUR",
        shippingDays: 6,
        shippingToBG: true,
        imageUrl: "https://picsum.photos/600?seed=hg4",
        status: "approved",
        score: 5,
        bg: { foundInBG: "no" },
      },
      {
        title: "Outdoor Camping Lantern USB",
        category: "outdoor",
        source: "aliexpress",
        sourceUrl: "https://example.com/lantern",
        price: 18.7,
        currency: "EUR",
        shippingDays: 8,
        shippingToBG: true,
        imageUrl: "https://picsum.photos/600?seed=hg5",
        status: "approved",
        score: 6,
        bg: { foundInBG: "no" },
      },
    ];

    let created = 0;
    let skipped = 0;

    for (const item of demo) {
      const normalizedSourceUrl = String(item.sourceUrl).trim();

      const affiliateUrl = buildAffiliateUrl(normalizedSourceUrl);
      const profitScore = computeProfitScore({
        ...item,
        affiliateUrl,
        price: item.price,
      });

      try {
        await Product.create({
          ...item,
          sourceUrl: normalizedSourceUrl,
          affiliateUrl,
          profitScore,
          createdBy: req.user.id,
        });
        created++;
      } catch (e) {
        // skip duplicates (unique sourceUrl)
        skipped++;
      }
    }

    return res.json({
      ok: true,
      message: "Seed completed",
      created,
      skipped,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Seed error",
      error: err.message,
    });
  }
});

/**
 * GET /admin/products
 * List products (admin only)
 * Optional:
 * - ?status=new|approved|rejected|blacklisted|all
 * - ?page=1&limit=100 (defaults)
 */
router.get("/products", auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.query || {};
    const page = Math.max(1, parseInt(req.query.page || "1", 10) || 1);
    const limitRaw = parseInt(req.query.limit || "200", 10) || 200;
    const limit = Math.max(1, Math.min(500, limitRaw)); // cap

    let q = {};
    if (status && status !== "all") {
      if (!ALLOWED_STATUS.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      q = { status };
    }

    const [items, total] = await Promise.all([
      Product.find(q)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Product.countDocuments(q),
    ]);

    return res.json({ ok: true, items, total, page, limit });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * PATCH /admin/products/:id/status
 * Body: { "status": "approved" }
 */
router.patch("/products/:id/status", auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updated = await Product.findByIdAndUpdate(id, { status }, { new: true });
    if (!updated) return res.status(404).json({ message: "Not found" });

    return res.json({ ok: true, product: updated });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * PATCH /admin/products/approve-many
 * Body: { "ids": ["id1","id2", ...] }
 */
router.patch("/products/approve-many", auth, adminOnly, async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids must be a non-empty array" });
    }

    const r = await Product.updateMany(
      { _id: { $in: ids } },
      { $set: { status: "approved" } }
    );

    return res.json({
      ok: true,
      matched: r.matchedCount ?? r.n,
      modified: r.modifiedCount ?? r.nModified,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * ✅ POST /admin/products/approve-existing
 * Approve ALL existing "new" products (admin only)
 */
router.post("/products/approve-existing", auth, adminOnly, async (req, res) => {
  try {
    const r = await Product.updateMany(
      { status: "new" },
      { $set: { status: "approved" } }
    );

    return res.json({
      ok: true,
      matched: r.matchedCount ?? r.n,
      modified: r.modifiedCount ?? r.nModified,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * ✅ POST /admin/products/backfill
 * Fill affiliateUrl (if empty) + recompute profitScore for ALL products
 */
router.post("/products/backfill", auth, adminOnly, async (req, res) => {
  try {
    const cursor = Product.find().cursor();

    let scanned = 0;
    let updated = 0;

    for await (const p of cursor) {
      scanned++;

      const nextAffiliate =
        (p.affiliateUrl && String(p.affiliateUrl).trim()) ||
        buildAffiliateUrl(p.sourceUrl);

      const nextProfit = computeProfitScore({
        ...p.toObject(),
        affiliateUrl: nextAffiliate,
      });

      const needAffiliate =
        !p.affiliateUrl || String(p.affiliateUrl).trim() === "";
      const needProfit =
        toSafeNumber(p.profitScore, 0) !== toSafeNumber(nextProfit, 0);

      if (needAffiliate || needProfit) {
        await Product.updateOne(
          { _id: p._id },
          {
            $set: {
              affiliateUrl: nextAffiliate,
              profitScore: nextProfit,
            },
          }
        );
        updated++;
      }
    }

    return res.json({ ok: true, scanned, updated });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * ✅ DELETE /admin/products/purge-example
 * Delete only example.com products (safe cleanup)
 */
router.delete("/products/purge-example", auth, adminOnly, async (req, res) => {
  try {
    const r = await Product.deleteMany({
      sourceUrl: { $regex: "^https://example\\.com/", $options: "i" },
    });

    return res.json({ ok: true, deleted: r.deletedCount ?? 0 });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * DELETE /admin/products/:id
 */
router.delete("/products/:id", auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
