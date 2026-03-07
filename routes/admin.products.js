const express = require("express");
const Product = require("../models/Product");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");

// auto re-categorize
const { categorizeProduct } = require("../services/categorizer");

const router = express.Router();

const ALLOWED_STATUS = ["new", "approved", "rejected", "blacklisted"];

/** helpers */
function toSafeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePriceFields(data = {}) {
  const price =
    data.price != null && data.price !== ""
      ? toSafeNumber(data.price, NaN)
      : null;

  const basePrice =
    data.basePrice != null && data.basePrice !== ""
      ? toSafeNumber(data.basePrice, NaN)
      : price;

  const markupValue =
    data.markupValue != null && data.markupValue !== ""
      ? toSafeNumber(data.markupValue, 0)
      : 0;

  let finalPrice =
    data.finalPrice != null && data.finalPrice !== ""
      ? toSafeNumber(data.finalPrice, NaN)
      : null;

  if (finalPrice == null || Number.isNaN(finalPrice)) {
    if (basePrice != null && !Number.isNaN(basePrice)) {
      if (data.markupType === "percent") {
        finalPrice = +(basePrice + (basePrice * markupValue) / 100).toFixed(2);
      } else if (data.markupType === "fixed") {
        finalPrice = +(basePrice + markupValue).toFixed(2);
      } else {
        finalPrice = basePrice;
      }
    }
  }

  return {
    price: Number.isNaN(price) ? null : price,
    basePrice: Number.isNaN(basePrice) ? null : basePrice,
    markupValue,
    finalPrice: Number.isNaN(finalPrice) ? null : finalPrice,
  };
}

/**
 * POST /admin/products
 * Create product (admin only)
 */
router.post("/products", auth, adminOnly, async (req, res) => {
  try {
    const data = req.body || {};
    const { title } = data;

    if (!title || !String(title).trim()) {
      return res.status(400).json({
        message: "Заглавието е задължително",
      });
    }

    const prices = normalizePriceFields(data);

    const payload = {
      ...data,
      title: String(title).trim(),
      source: String(data.source || "manual").trim(),
      sourceUrl: String(data.sourceUrl || "").trim(),
      affiliateUrl: "",

      shortDescription: String(data.shortDescription || "").trim(),
      description: String(data.description || "").trim(),
      sku: String(data.sku || "").trim(),
      brand: String(data.brand || "").trim(),

      imageUrl: String(data.imageUrl || "").trim(),
      images: Array.isArray(data.images) ? data.images : [],

      currency: String(data.currency || "BGN").trim(),
      shippingPrice: toSafeNumber(data.shippingPrice, 0),
      shippingToBG:
        typeof data.shippingToBG === "boolean" ? data.shippingToBG : true,
      shippingDays:
        data.shippingDays != null && data.shippingDays !== ""
          ? toSafeNumber(data.shippingDays, null)
          : null,

      markupType: ["none", "percent", "fixed"].includes(data.markupType)
        ? data.markupType
        : "none",

      stockStatus: ["unknown", "in_stock", "out_of_stock"].includes(data.stockStatus)
        ? data.stockStatus
        : "unknown",

      stockQty:
        data.stockQty != null && data.stockQty !== ""
          ? toSafeNumber(data.stockQty, null)
          : null,

      isActive: typeof data.isActive === "boolean" ? data.isActive : true,
      isFeatured: typeof data.isFeatured === "boolean" ? data.isFeatured : false,

      status: ALLOWED_STATUS.includes(data.status) ? data.status : "new",

      ...prices,
      createdBy: req.user.id,
    };

    const product = await Product.create(payload);
    return res.status(201).json({ ok: true, product });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({
        message: "Продукт с такъв уникален ключ вече съществува",
      });
    }

    return res.status(500).json({
      message: "Грешка в сървъра",
      error: err.message,
    });
  }
});

/**
 * POST /admin/products/seed
 * Demo продукти за магазин
 */
router.post("/products/seed", auth, adminOnly, async (req, res) => {
  try {
    const demo = [
      {
        title: "Визьор за каска LS2 FF353",
        shortDescription: "Прозрачен визьор за модел LS2 FF353",
        category: "other",
        source: "manual",
        price: 40,
        basePrice: 20,
        markupType: "fixed",
        markupValue: 20,
        finalPrice: 40,
        currency: "BGN",
        shippingDays: 2,
        shippingToBG: true,
        imageUrl: "https://picsum.photos/600?seed=moto1",
        status: "approved",
        stockStatus: "in_stock",
        stockQty: 5,
        isActive: true,
      },
      {
        title: "Механизъм за визьор HJC",
        shortDescription: "Комплект механизъм за монтаж на визьор",
        category: "other",
        source: "manual",
        price: 25,
        basePrice: 12,
        markupType: "fixed",
        markupValue: 13,
        finalPrice: 25,
        currency: "BGN",
        shippingDays: 2,
        shippingToBG: true,
        imageUrl: "https://picsum.photos/600?seed=moto2",
        status: "approved",
        stockStatus: "in_stock",
        stockQty: 8,
        isActive: true,
      },
      {
        title: "Пинове за anti-fog визьор",
        shortDescription: "Резервни пинове за anti-fog система",
        category: "other",
        source: "manual",
        price: 10,
        basePrice: 4,
        markupType: "fixed",
        markupValue: 6,
        finalPrice: 10,
        currency: "BGN",
        shippingDays: 2,
        shippingToBG: true,
        imageUrl: "https://picsum.photos/600?seed=moto3",
        status: "approved",
        stockStatus: "in_stock",
        stockQty: 20,
        isActive: true,
      },
    ];

    let created = 0;
    let skipped = 0;

    for (const item of demo) {
      try {
        await Product.create({
          ...item,
          createdBy: req.user.id,
        });
        created++;
      } catch (e) {
        skipped++;
      }
    }

    return res.json({
      ok: true,
      message: "Демо продуктите са добавени",
      created,
      skipped,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Грешка при seed",
      error: err.message,
    });
  }
});

/**
 * GET /admin/products
 * List products (admin only)
 * Optional:
 * - ?status=new|approved|rejected|blacklisted|all
 * - ?page=1&limit=100
 */
router.get("/products", auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.query || {};
    const page = Math.max(1, parseInt(req.query.page || "1", 10) || 1);
    const limitRaw = parseInt(req.query.limit || "200", 10) || 200;
    const limit = Math.max(1, Math.min(500, limitRaw));

    let q = {};
    if (status && status !== "all") {
      if (!ALLOWED_STATUS.includes(status)) {
        return res.status(400).json({ message: "Невалиден статус" });
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
    return res.status(500).json({ message: "Грешка в сървъра", error: err.message });
  }
});

/**
 * PATCH /admin/products/:id/status
 */
router.patch("/products/:id/status", auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({ message: "Невалиден статус" });
    }

    const updated = await Product.findByIdAndUpdate(id, { status }, { new: true });
    if (!updated) return res.status(404).json({ message: "Не е намерен" });

    return res.json({ ok: true, product: updated });
  } catch (err) {
    return res.status(500).json({ message: "Грешка в сървъра", error: err.message });
  }
});

/**
 * PATCH /admin/products/:id
 * Обновяване на продукт
 */
router.patch("/products/:id", auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body || {};

    const prices = normalizePriceFields(data);

    const patch = {
      ...data,
      ...prices,
    };

    if (patch.title != null) patch.title = String(patch.title).trim();
    if (patch.shortDescription != null) patch.shortDescription = String(patch.shortDescription).trim();
    if (patch.description != null) patch.description = String(patch.description).trim();
    if (patch.sku != null) patch.sku = String(patch.sku).trim();
    if (patch.brand != null) patch.brand = String(patch.brand).trim();
    if (patch.source != null) patch.source = String(patch.source || "manual").trim();
    if (patch.sourceUrl != null) patch.sourceUrl = String(patch.sourceUrl || "").trim();
    if (patch.imageUrl != null) patch.imageUrl = String(patch.imageUrl || "").trim();

    if (patch.markupType && !["none", "percent", "fixed"].includes(patch.markupType)) {
      patch.markupType = "none";
    }

    if (patch.stockStatus && !["unknown", "in_stock", "out_of_stock"].includes(patch.stockStatus)) {
      patch.stockStatus = "unknown";
    }

    const updated = await Product.findByIdAndUpdate(id, { $set: patch }, { new: true });
    if (!updated) return res.status(404).json({ message: "Не е намерен" });

    return res.json({ ok: true, product: updated });
  } catch (err) {
    return res.status(500).json({ message: "Грешка в сървъра", error: err.message });
  }
});

/**
 * PATCH /admin/products/approve-many
 */
router.patch("/products/approve-many", auth, adminOnly, async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids трябва да е непразен масив" });
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
    return res.status(500).json({ message: "Грешка в сървъра", error: err.message });
  }
});

/**
 * POST /admin/products/approve-existing
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
    return res.status(500).json({ message: "Грешка в сървъра", error: err.message });
  }
});

/**
 * Auto re-categorize products missing categoryPath
 */
router.post("/products/recategorize-missing", auth, adminOnly, async (req, res) => {
  try {
    const query = {
      $or: [
        { categoryPath: { $exists: false } },
        { categoryPath: { $type: "array", $size: 0 } },
      ],
    };

    const items = await Product.find(query).limit(500).lean();
    let updated = 0;

    for (const p of items) {
      const cat = await categorizeProduct({
        title: p.title,
        categoryText: p.categoryText || p.category,
        description: p.description,
        brand: p.brand,
      });

      const patch = {};
      if (Array.isArray(cat.categoryPath) && cat.categoryPath.length) {
        patch.categoryPath = cat.categoryPath;
      }
      if (cat.categoryId) patch.categoryId = cat.categoryId;
      if (cat.legacyCategory) patch.category = cat.legacyCategory;

      if (Object.keys(patch).length) {
        await Product.updateOne({ _id: p._id }, { $set: patch });
        updated++;
      }
    }

    return res.json({
      ok: true,
      message: `Готово. Проверени: ${items.length} / обновени: ${updated}`,
      scanned: items.length,
      updated,
    });
  } catch (err) {
    return res.status(500).json({ message: "Грешка в сървъра", error: err.message });
  }
});

/**
 * DELETE /admin/products/:id
 */
router.delete("/products/:id", auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Не е намерен" });

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Грешка в сървъра", error: err.message });
  }
});

/**
 * POST /admin/categories/seed
 */
router.post("/categories/seed", auth, adminOnly, async (req, res) => {
  try {
    const Category = require("../models/Category");

    const existing = await Category.countDocuments();
    if (existing > 0) {
      return res.json({
        ok: true,
        message: "Категориите вече съществуват",
        count: existing,
      });
    }

    const now = new Date();

    function make({ name, slug, path, level, parent = null, order = 0 }) {
      return {
        name,
        slug,
        path,
        level,
        parent,
        order,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
    }

    const roots = await Category.insertMany([
      make({ name: "Home", slug: "home", path: ["home"], level: 0, order: 1 }),
      make({ name: "Garden", slug: "garden", path: ["garden"], level: 0, order: 2 }),
      make({ name: "Tools", slug: "tools", path: ["tools"], level: 0, order: 3 }),
      make({ name: "Outdoor", slug: "outdoor", path: ["outdoor"], level: 0, order: 4 }),
    ]);

    const rootBySlug = {};
    for (const r of roots) rootBySlug[r.slug] = r;

    const lvl1 = await Category.insertMany([
      make({
        name: "Kitchen",
        slug: "kitchen",
        path: ["home", "kitchen"],
        level: 1,
        parent: rootBySlug.home._id,
        order: 1,
      }),
      make({
        name: "Bathroom",
        slug: "bathroom",
        path: ["home", "bathroom"],
        level: 1,
        parent: rootBySlug.home._id,
        order: 2,
      }),
      make({
        name: "Cleaning",
        slug: "cleaning",
        path: ["home", "cleaning"],
        level: 1,
        parent: rootBySlug.home._id,
        order: 3,
      }),
      make({
        name: "Storage",
        slug: "storage",
        path: ["home", "storage"],
        level: 1,
        parent: rootBySlug.home._id,
        order: 4,
      }),
      make({
        name: "Decor",
        slug: "decor",
        path: ["home", "decor"],
        level: 1,
        parent: rootBySlug.home._id,
        order: 5,
      }),
      make({
        name: "Watering",
        slug: "watering",
        path: ["garden", "watering"],
        level: 1,
        parent: rootBySlug.garden._id,
        order: 1,
      }),
      make({
        name: "Plants",
        slug: "plants",
        path: ["garden", "plants"],
        level: 1,
        parent: rootBySlug.garden._id,
        order: 2,
      }),
      make({
        name: "Garden Furniture",
        slug: "garden-furniture",
        path: ["garden", "garden-furniture"],
        level: 1,
        parent: rootBySlug.garden._id,
        order: 3,
      }),
      make({
        name: "Garden Tools",
        slug: "garden-tools",
        path: ["garden", "garden-tools"],
        level: 1,
        parent: rootBySlug.garden._id,
        order: 4,
      }),
      make({
        name: "Power Tools",
        slug: "power-tools",
        path: ["tools", "power-tools"],
        level: 1,
        parent: rootBySlug.tools._id,
        order: 1,
      }),
      make({
        name: "Hand Tools",
        slug: "hand-tools",
        path: ["tools", "hand-tools"],
        level: 1,
        parent: rootBySlug.tools._id,
        order: 2,
      }),
      make({
        name: "Tool Storage",
        slug: "tool-storage",
        path: ["tools", "tool-storage"],
        level: 1,
        parent: rootBySlug.tools._id,
        order: 3,
      }),
      make({
        name: "Camping",
        slug: "camping",
        path: ["outdoor", "camping"],
        level: 1,
        parent: rootBySlug.outdoor._id,
        order: 1,
      }),
      make({
        name: "BBQ",
        slug: "bbq",
        path: ["outdoor", "bbq"],
        level: 1,
        parent: rootBySlug.outdoor._id,
        order: 2,
      }),
      make({
        name: "Lighting",
        slug: "lighting",
        path: ["outdoor", "lighting"],
        level: 1,
        parent: rootBySlug.outdoor._id,
        order: 3,
      }),
    ]);

    return res.json({
      ok: true,
      message: "Категориите са добавени",
      created: roots.length + lvl1.length,
    });
  } catch (err) {
    return res.status(500).json({ message: "Грешка при seed", error: err.message });
  }
});

module.exports = router;