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
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}ref=${encodeURIComponent(AFF_TAG)}`;
}

function computeProfitScore(p) {
  // MVP formula (същата идея като в бота)
  let ps = 0;

  const score = Number(p.score || 0);
  ps += score;

  if (p.affiliateUrl && String(p.affiliateUrl).trim()) ps += 2;

  const price = Number(p.price);
  if (!Number.isNaN(price) && price <= 30) ps += 1;

  const shippingDays =
    p.shippingDays == null ? null : Number(p.shippingDays);
  if (shippingDays != null && !Number.isNaN(shippingDays) && shippingDays <= 10)
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

    const payload = {
      ...data,
      title: String(title).trim(),
      sourceUrl: normalizedSourceUrl,
      affiliateUrl,
      price: Number(price),
      profitScore: computeProfitScore({ ...data, affiliateUrl }), // ✅
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
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * GET /admin/products
 * List products (admin only)
 * Optional: ?status=new
 */
router.get("/products", auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.query || {};
    const q = status ? { status } : {};
    const items = await Product.find(q).sort({ createdAt: -1 }).limit(500);
    return res.json({ ok: true, items });
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

    const updated = await Product.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
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
      const needProfit = Number(p.profitScore || 0) !== Number(nextProfit);

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
