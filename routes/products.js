const express = require("express");
const Product = require("../models/Product");

const router = express.Router();

/**
 * ✅ Публичен филтър за магазин:
 * - само одобрени
 * - само активни
 */
function publicMatch() {
  return {
    status: "approved",
    isActive: true,
  };
}

/**
 * ✅ Legacy single category -> catalog path
 */
function legacyToCatalogPath(cat) {
  const c = String(cat || "").trim().toLowerCase();
  if (!c || c === "all") return null;

  if (c.includes("/")) return c.split("/").filter(Boolean);

  if (["home", "garden", "tools", "outdoor", "kitchen", "storage", "other"].includes(c)) {
    return [c];
  }

  return [c];
}

/**
 * ✅ Категориен филтър:
 * - categoryPath ако има
 * - fallback към legacy category
 */
function applyCategoryFilter(filter, category) {
  const path = legacyToCatalogPath(category);
  if (!path || !path.length) return;

  const prefixExpr = {
    $expr: {
      $eq: [{ $slice: ["$categoryPath", path.length] }, path],
    },
  };

  const allMatch = { categoryPath: { $all: path } };

  const legacyFallback = path.length === 1 ? { category: path[0] } : null;

  filter.$and = filter.$and || [];
  filter.$and.push({
    $or: [
      prefixExpr,
      allMatch,
      ...(legacyFallback ? [legacyFallback] : []),
    ],
  });
}

/**
 * ✅ Сортиране за магазин
 */
function getSort(sort) {
  const s = String(sort || "newest").toLowerCase();

  switch (s) {
    case "priceasc":
      return { finalPrice: 1, price: 1, createdAt: -1 };

    case "pricedesc":
      return { finalPrice: -1, price: -1, createdAt: -1 };

    case "popular":
      return { views: -1, clicks: -1, createdAt: -1 };

    case "featured":
      return { isFeatured: -1, createdAt: -1 };

    case "newest":
    default:
      return { createdAt: -1 };
  }
}

/**
 * ✅ TOP продукти
 * GET /products/top
 *
 * Query:
 * ?by=views
 * ?by=clicks
 * ?by=newest
 * ?limit=20
 */
router.get("/top", async (req, res) => {
  try {
    const by = String(req.query.by || "views").toLowerCase();
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const baseMatch = publicMatch();

    let sort = { views: -1, clicks: -1, createdAt: -1 };

    if (by === "clicks") {
      sort = { clicks: -1, views: -1, createdAt: -1 };
    } else if (by === "newest") {
      sort = { createdAt: -1 };
    }

    const items = await Product.find(baseMatch).sort(sort).limit(limit);

    return res.json({ ok: true, by, limit, items });
  } catch (err) {
    return res.status(500).json({ message: "Грешка в сървъра", error: err.message });
  }
});

/**
 * ✅ Публични продукти
 * GET /products
 *
 * Query params:
 * ?page=1
 * ?limit=20
 * ?q=search text
 * ?category=home
 * ?category=home/kitchen/cookware
 * ?sort=newest|priceAsc|priceDesc|popular|featured
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const { q, category, sort } = req.query || {};

    const filter = publicMatch();

    if (q && String(q).trim()) {
      filter.title = { $regex: String(q).trim(), $options: "i" };
    }

    if (category && category !== "all") {
      applyCategoryFilter(filter, category);
    }

    const items = await Product.find(filter)
      .sort(getSort(sort))
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(filter);

    return res.json({
      ok: true,
      page,
      limit,
      total,
      items,
    });
  } catch (err) {
    return res.status(500).json({ message: "Грешка в сървъра", error: err.message });
  }
});

/**
 * ✅ Детайли за продукт
 * GET /products/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const item = await Product.findOne({
      _id: req.params.id,
      ...publicMatch(),
    });

    if (!item) {
      return res.status(404).json({ message: "Продуктът не е намерен" });
    }

    return res.json({ ok: true, item });
  } catch (err) {
    return res.status(500).json({ message: "Грешка в сървъра", error: err.message });
  }
});

/**
 * ✅ Броене на прегледи
 * GET /products/:id/view
 */
router.get("/:id/view", async (req, res) => {
  try {
    const item = await Product.findOneAndUpdate(
      { _id: req.params.id, ...publicMatch() },
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ message: "Продуктът не е намерен" });
    }

    return res.json({ ok: true, views: item.views });
  } catch (err) {
    return res.status(500).json({ message: "Грешка в сървъра", error: err.message });
  }
});

/**
 * ✅ Броене на интерес / клик
 * GET /products/:id/click
 *
 * Вече НЕ правим redirect, защото сайтът става реален магазин.
 * Само увеличаваме clicks за статистика.
 */
router.get("/:id/click", async (req, res) => {
  try {
    const item = await Product.findOneAndUpdate(
      { _id: req.params.id, ...publicMatch() },
      { $inc: { clicks: 1 } },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ message: "Продуктът не е намерен" });
    }

    return res.json({
      ok: true,
      clicks: item.clicks,
      message: "Кликът е отчетен",
    });
  } catch (err) {
    return res.status(500).json({ message: "Грешка в сървъра", error: err.message });
  }
});

module.exports = router;