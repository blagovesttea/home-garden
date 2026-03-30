const express = require("express");
const Product = require("../models/Product");

const router = express.Router();

/**
 * Само публични продукти:
 * - одобрени
 * - активни
 */
function publicMatch() {
  return {
    status: "approved",
    isActive: true,
  };
}

/**
 * Категорийни alias-и за кафе магазина
 * legacy category -> реален categoryPath
 */
const LEGACY_TO_PATH = {
  "coffee-beans": ["kafe", "kafe-na-zarna"],
  "ground-coffee": ["kafe", "mlyano-kafe"],
  capsules: ["kafe", "kapsuli"],
  pods: ["kafe", "dozi-i-pods"],
  machines: ["kafemashini"],
  grinders: ["aksesoari", "melachki"],
  accessories: ["aksesoari", "barista-aksesoari"],
  cups: ["aksesoari", "chashi-i-termosi"],
  syrups: ["siropi-i-dobavki", "siropi"],
  "gift-sets": ["kafe"],
  "office-coffee": ["ofis-i-horeca", "kafe-za-ofisi"],
  horeca: ["ofis-i-horeca"],
  other: [],
};

const TEXT_TO_CANONICAL = {
  "кафе": "kafe",
  "кафе на зърна": "kafe-na-zarna",
  "кафе-на-зърна": "kafe-na-zarna",
  "зърна": "kafe-na-zarna",
  "мляно кафе": "mlyano-kafe",
  "мляно-кафе": "mlyano-kafe",
  "капсули": "kapsuli",
  "дози": "dozi-i-pods",
  "pods": "dozi-i-pods",
  "дози и pods": "dozi-i-pods",
  "дози-и-pods": "dozi-i-pods",
  "кафемашини": "kafemashini",
  "машини": "kafemashini",
  "мелачки": "melachki",
  "аксесоари": "aksesoari",
  "чаши": "chashi-i-termosi",
  "чаши и термоси": "chashi-i-termosi",
  "чаши-и-термоси": "chashi-i-termosi",
  "сиропи": "siropi",
  "сиропи и добавки": "siropi-i-dobavki",
  "сиропи-и-добавки": "siropi-i-dobavki",
  "подаръчни комплекти": "gift-sets",
  "подаръчни-комплекти": "gift-sets",
  "офис": "ofis-i-horeca",
  "офис кафе": "office-coffee",
  "офис-кафе": "office-coffee",
  horeca: "horeca",

  "coffee-beans": "coffee-beans",
  "ground-coffee": "ground-coffee",
  capsules: "capsules",
  pods: "pods",
  machines: "machines",
  grinders: "grinders",
  accessories: "accessories",
  cups: "cups",
  syrups: "syrups",
  "gift-sets": "gift-sets",
  "office-coffee": "office-coffee",
  other: "other",
};

const SINGLE_SLUG_TO_FULL_PATH = {
  kafe: ["kafe"],
  "kafe-na-zarna": ["kafe", "kafe-na-zarna"],
  "mlyano-kafe": ["kafe", "mlyano-kafe"],
  kapsuli: ["kafe", "kapsuli"],
  "dozi-i-pods": ["kafe", "dozi-i-pods"],
  kafemashini: ["kafemashini"],
  "avtomatichni-kafemashini": ["kafemashini", "avtomatichni-kafemashini"],
  "kapsulni-mashini": ["kafemashini", "kapsulni-mashini"],
  "profesionalni-mashini": ["kafemashini", "profesionalni-mashini"],
  aksesoari: ["aksesoari"],
  melachki: ["aksesoari", "melachki"],
  "barista-aksesoari": ["aksesoari", "barista-aksesoari"],
  "chashi-i-termosi": ["aksesoari", "chashi-i-termosi"],
  "siropi-i-dobavki": ["siropi-i-dobavki"],
  siropi: ["siropi-i-dobavki", "siropi"],
  podsladiteli: ["siropi-i-dobavki", "podsladiteli"],
  "ofis-i-horeca": ["ofis-i-horeca"],
  "kafe-za-ofisi": ["ofis-i-horeca", "kafe-za-ofisi"],
  "kafe-za-hoteli": ["ofis-i-horeca", "kafe-za-hoteli"],
  vending: ["ofis-i-horeca", "vending"],
};

/**
 * Нормализира category/path за кафе магазина
 * Връща:
 * {
 *   legacyCategory: "coffee-beans" | ... | null,
 *   path: ["kafe","kafe-na-zarna"] | ...
 * }
 */
function normalizeCategoryInput(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw || raw === "all") {
    return {
      legacyCategory: null,
      path: null,
    };
  }

  if (LEGACY_TO_PATH[raw]) {
    return {
      legacyCategory: raw,
      path: LEGACY_TO_PATH[raw],
    };
  }

  if (raw.includes("/")) {
    const segments = raw
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => TEXT_TO_CANONICAL[s] || s);

    return {
      legacyCategory: null,
      path: segments.length ? segments : null,
    };
  }

  const canonical = TEXT_TO_CANONICAL[raw] || raw;

  if (LEGACY_TO_PATH[canonical]) {
    return {
      legacyCategory: canonical,
      path: LEGACY_TO_PATH[canonical],
    };
  }

  if (SINGLE_SLUG_TO_FULL_PATH[canonical]) {
    return {
      legacyCategory: null,
      path: SINGLE_SLUG_TO_FULL_PATH[canonical],
    };
  }

  return {
    legacyCategory: canonical,
    path: [canonical],
  };
}

/**
 * Категориен филтър:
 * - реален categoryPath prefix match
 * - fallback към legacy category
 */
function applyCategoryFilter(filter, category) {
  const normalized = normalizeCategoryInput(category);
  if (!normalized.path && !normalized.legacyCategory) return;

  const orConditions = [];

  if (normalized.path && normalized.path.length) {
    orConditions.push({
      $expr: {
        $eq: [{ $slice: ["$categoryPath", normalized.path.length] }, normalized.path],
      },
    });

    orConditions.push({
      categoryPath: { $all: normalized.path },
    });
  }

  if (normalized.legacyCategory) {
    orConditions.push({
      category: normalized.legacyCategory,
    });
  }

  if (!orConditions.length) return;

  filter.$and = filter.$and || [];
  filter.$and.push({
    $or: orConditions,
  });
}

/**
 * По-силен search за магазин:
 * търси в title, shortDescription, description, brand, sku
 */
function applySearchFilter(filter, query) {
  const q = String(query || "").trim();
  if (!q) return;

  const rx = { $regex: q, $options: "i" };

  filter.$and = filter.$and || [];
  filter.$and.push({
    $or: [
      { title: rx },
      { shortDescription: rx },
      { description: rx },
      { brand: rx },
      { sku: rx },
      { category: rx },
      { categoryPath: rx },
    ],
  });
}

/**
 * Сортиране за магазина
 */
function getSort(sort) {
  const s = String(sort || "featured").toLowerCase();

  switch (s) {
    case "priceasc":
      return { finalPrice: 1, price: 1, createdAt: -1 };

    case "pricedesc":
      return { finalPrice: -1, price: -1, createdAt: -1 };

    case "popular":
      return { views: -1, clicks: -1, isFeatured: -1, createdAt: -1 };

    case "newest":
      return { createdAt: -1, isFeatured: -1 };

    case "featured":
    default:
      return { isFeatured: -1, views: -1, createdAt: -1 };
  }
}

/**
 * GET /products/top
 *
 * Query:
 * ?by=views
 * ?by=clicks
 * ?by=newest
 * ?by=featured
 * ?limit=20
 * ?category=coffee-beans
 */
router.get("/top", async (req, res) => {
  try {
    const by = String(req.query.by || "views").toLowerCase();
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const category = String(req.query.category || "").trim();

    const filter = publicMatch();

    if (category && category !== "all") {
      applyCategoryFilter(filter, category);
    }

    let sort = { views: -1, clicks: -1, isFeatured: -1, createdAt: -1 };

    if (by === "clicks") {
      sort = { clicks: -1, views: -1, isFeatured: -1, createdAt: -1 };
    } else if (by === "newest") {
      sort = { createdAt: -1, isFeatured: -1 };
    } else if (by === "featured") {
      sort = { isFeatured: -1, views: -1, createdAt: -1 };
    }

    const items = await Product.find(filter).sort(sort).limit(limit);

    return res.json({
      ok: true,
      by,
      limit,
      items,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Грешка в сървъра",
      error: err.message,
    });
  }
});

/**
 * GET /products
 *
 * Query params:
 * ?page=1
 * ?limit=20
 * ?q=search text
 * ?category=coffee-beans
 * ?category=kafe/kafe-na-zarna
 * ?sort=newest|priceAsc|priceDesc|popular|featured
 * ?featured=true
 * ?brand=Lavazza
 * ?stock=in_stock
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const { q, category, sort, featured, brand, stock } = req.query || {};

    const filter = publicMatch();

    applySearchFilter(filter, q);

    if (category && category !== "all") {
      applyCategoryFilter(filter, category);
    }

    if (String(featured || "").toLowerCase() === "true") {
      filter.isFeatured = true;
    }

    if (brand && String(brand).trim()) {
      filter.brand = { $regex: String(brand).trim(), $options: "i" };
    }

    if (
      stock &&
      ["unknown", "in_stock", "out_of_stock"].includes(String(stock).trim())
    ) {
      filter.stockStatus = String(stock).trim();
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
      pages: Math.max(1, Math.ceil(total / limit)),
      items,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Грешка в сървъра",
      error: err.message,
    });
  }
});

/**
 * GET /products/:id
 * Детайли за продукт
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
    return res.status(500).json({
      message: "Грешка в сървъра",
      error: err.message,
    });
  }
});

/**
 * GET /products/:id/view
 * Броене на прегледи
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
    return res.status(500).json({
      message: "Грешка в сървъра",
      error: err.message,
    });
  }
});

/**
 * GET /products/:id/click
 * Броене на интерес / клик
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
    return res.status(500).json({
      message: "Грешка в сървъра",
      error: err.message,
    });
  }
});

module.exports = router;