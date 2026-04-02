const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Category = require("../models/Category");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");

// auto re-categorize
const { categorizeProduct } = require("../services/categorizer");

const router = express.Router();

const ALLOWED_STATUS = ["new", "approved", "rejected", "blacklisted"];
const ALLOWED_MARKUP = ["none", "percent", "fixed"];
const ALLOWED_STOCK = ["unknown", "in_stock", "out_of_stock"];
const ALLOWED_CATEGORIES = [
  "coffee-beans",
  "ground-coffee",
  "capsules",
  "pods",
  "machines",
  "grinders",
  "accessories",
  "cups",
  "syrups",
  "gift-sets",
  "office-coffee",
  "horeca",
  "other",
];

const ALLOWED_WEIGHT_UNITS = ["g", "kg", "ml", "l", "pcs", ""];
const ALLOWED_ROAST_LEVELS = ["", "light", "medium", "medium-dark", "dark"];
const ALLOWED_CAFFEINE_TYPES = ["", "regular", "decaf"];

const MANUAL_CATEGORY_PATHS = {
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

/** helpers */
function toSafeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(v, fallback = "") {
  return String(v ?? fallback).trim();
}

function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images.map((x) => String(x || "").trim()).filter(Boolean);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x || "").trim()).filter(Boolean);
}

function normalizeCategory(category) {
  const c = normalizeText(category, "coffee-beans").toLowerCase();
  return ALLOWED_CATEGORIES.includes(c) ? c : "coffee-beans";
}

function normalizeCategoryPath(value) {
  if (Array.isArray(value)) {
    return value.map((x) => String(x || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.includes(">")) {
      return trimmed
        .split(">")
        .map((x) => x.trim())
        .filter(Boolean);
    }

    if (trimmed.includes("/")) {
      return trimmed
        .split("/")
        .map((x) => x.trim())
        .filter(Boolean);
    }

    if (trimmed.includes(",")) {
      return trimmed
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }

    return [trimmed];
  }

  return [];
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return fallback;
}

function normalizeNullableNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function generateUniqueSlug(title, excludeId = null) {
  const base = slugify(title) || `product-${Date.now()}`;
  let candidate = base;
  let counter = 2;

  while (true) {
    const existing = await Product.findOne({
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      .select("_id")
      .lean();

    if (!existing) return candidate;

    candidate = `${base}-${counter}`;
    counter += 1;
  }
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

  const markupType = ALLOWED_MARKUP.includes(data.markupType)
    ? data.markupType
    : "none";

  if (finalPrice == null || Number.isNaN(finalPrice)) {
    if (basePrice != null && !Number.isNaN(basePrice)) {
      if (markupType === "percent") {
        finalPrice = +(basePrice + (basePrice * markupValue) / 100).toFixed(2);
      } else if (markupType === "fixed") {
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
    markupType,
  };
}

async function resolveManualCategoryMeta(category) {
  const normalizedCategory = normalizeCategory(category);
  const mappedPath = MANUAL_CATEGORY_PATHS[normalizedCategory] || [];

  if (!mappedPath.length) {
    return {
      category: normalizedCategory,
      categoryId: null,
      categoryPath: [],
    };
  }

  const exact = await Category.findOne({
    path: mappedPath,
    isActive: true,
  })
    .select("_id path slug")
    .lean();

  if (exact) {
    return {
      category: normalizedCategory,
      categoryId: exact._id,
      categoryPath: exact.path || mappedPath,
    };
  }

  return {
    category: normalizedCategory,
    categoryId: null,
    categoryPath: mappedPath,
  };
}

async function resolveCategoryMeta(input = {}) {
  const rawCategory = normalizeText(input.category, "");
  const rawCategoryId = normalizeText(input.categoryId, "");
  const rawCategoryPath = normalizeCategoryPath(input.categoryPath);

  if (rawCategoryId && isValidObjectId(rawCategoryId)) {
    const byId = await Category.findOne({
      _id: rawCategoryId,
      isActive: true,
    })
      .select("_id path slug")
      .lean();

    if (byId) {
      return {
        category:
          rawCategory && ALLOWED_CATEGORIES.includes(rawCategory)
            ? rawCategory
            : normalizeCategory(byId.slug || rawCategory || "coffee-beans"),
        categoryId: byId._id,
        categoryPath: Array.isArray(byId.path) ? byId.path : [],
      };
    }
  }

  if (rawCategoryPath.length) {
    const byPath = await Category.findOne({
      path: rawCategoryPath,
      isActive: true,
    })
      .select("_id path slug")
      .lean();

    if (byPath) {
      return {
        category:
          rawCategory && ALLOWED_CATEGORIES.includes(rawCategory)
            ? rawCategory
            : normalizeCategory(byPath.slug || rawCategory || "coffee-beans"),
        categoryId: byPath._id,
        categoryPath: Array.isArray(byPath.path) ? byPath.path : rawCategoryPath,
      };
    }

    return {
      category: normalizeCategory(rawCategory || "coffee-beans"),
      categoryId: null,
      categoryPath: rawCategoryPath,
    };
  }

  return resolveManualCategoryMeta(rawCategory || "coffee-beans");
}

function buildProductPayload(data = {}, userId = null) {
  const prices = normalizePriceFields(data);

  const weightUnit = normalizeText(data.weightUnit);
  const roastLevel = normalizeText(data.roastLevel);
  const caffeineType = normalizeText(data.caffeineType);

  return {
    title: normalizeText(data.title),
    shortDescription: normalizeText(data.shortDescription),
    description: normalizeText(data.description),
    sku: normalizeText(data.sku),
    brand: normalizeText(data.brand),

    category: normalizeCategory(data.category),

    source: normalizeText(data.source, "manual"),
    sourceUrl: normalizeText(data.sourceUrl),
    affiliateUrl: "",

    imageUrl: normalizeText(data.imageUrl),
    images: normalizeImages(data.images),

    currency: normalizeText(data.currency, "BGN") || "BGN",

    shippingPrice: toSafeNumber(data.shippingPrice, 0),
    shippingToBG: normalizeBoolean(data.shippingToBG, true),
    shippingDays: normalizeNullableNumber(data.shippingDays),

    stockStatus: ALLOWED_STOCK.includes(data.stockStatus)
      ? data.stockStatus
      : "unknown",

    stockQty: normalizeNullableNumber(data.stockQty),

    isActive: normalizeBoolean(data.isActive, true),
    isFeatured: normalizeBoolean(data.isFeatured, false),

    status: ALLOWED_STATUS.includes(data.status) ? data.status : "new",

    weight: normalizeNullableNumber(data.weight),

    weightUnit: ALLOWED_WEIGHT_UNITS.includes(weightUnit) ? weightUnit : "",

    packCount: normalizeNullableNumber(data.packCount),

    roastLevel: ALLOWED_ROAST_LEVELS.includes(roastLevel) ? roastLevel : "",

    intensity: normalizeNullableNumber(data.intensity),

    caffeineType: ALLOWED_CAFFEINE_TYPES.includes(caffeineType)
      ? caffeineType
      : "",

    compatibleWith: normalizeStringArray(data.compatibleWith),
    badges: normalizeStringArray(data.badges),

    isNew: normalizeBoolean(data.isNew, false),
    isOnSale: normalizeBoolean(data.isOnSale, false),

    oldPrice: normalizeNullableNumber(data.oldPrice),

    rating:
      data.rating != null && data.rating !== ""
        ? toSafeNumber(data.rating, 0)
        : 0,

    reviewsCount:
      data.reviewsCount != null && data.reviewsCount !== ""
        ? toSafeNumber(data.reviewsCount, 0)
        : 0,

    ...prices,

    ...(userId ? { createdBy: userId } : {}),
  };
}

/**
 * POST /admin/products
 * Create product (admin only)
 */
router.post("/products", auth, adminOnly, async (req, res) => {
  try {
    const data = req.body || {};

    if (!data.title || !String(data.title).trim()) {
      return res.status(400).json({
        message: "Заглавието е задължително",
      });
    }

    const payload = buildProductPayload(data, req.user.id);
    const categoryMeta = await resolveCategoryMeta(data);

    payload.category = categoryMeta.category;
    payload.categoryId = categoryMeta.categoryId;
    payload.categoryPath = categoryMeta.categoryPath;
    payload.slug = await generateUniqueSlug(payload.title);

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
 * Демо продукти за кафе магазин
 */
router.post("/products/seed", auth, adminOnly, async (req, res) => {
  try {
    const demo = [
      {
        title: "Lavazza Qualità Oro – кафе на зърна 1 кг",
        shortDescription:
          "Премиум италианско кафе на зърна с мек и балансиран вкус.",
        description:
          "Подходящо за еспресо, автоматични кафемашини и домашна употреба.",
        brand: "Lavazza",
        category: "coffee-beans",
        source: "manual",
        price: 44.9,
        basePrice: 39.9,
        markupType: "fixed",
        markupValue: 5,
        finalPrice: 44.9,
        oldPrice: 49.9,
        currency: "BGN",
        shippingDays: 1,
        shippingToBG: true,
        imageUrl: "https://picsum.photos/900?seed=coffee1",
        status: "approved",
        stockStatus: "in_stock",
        stockQty: 12,
        isActive: true,
        isFeatured: true,
        isNew: true,
        isOnSale: true,
        weight: 1,
        weightUnit: "kg",
        roastLevel: "medium",
        intensity: 8,
        caffeineType: "regular",
        badges: ["Ново", "Промо", "Топ продукт"],
        rating: 4.8,
        reviewsCount: 124,
      },
      {
        title: "illy Classico – мляно кафе 250 г",
        shortDescription: "Фино мляно кафе с наситен аромат и мек послевкус.",
        description:
          "Идеално за домашна употреба, moka pot и класическо еспресо.",
        brand: "illy",
        category: "ground-coffee",
        source: "manual",
        price: 18.9,
        basePrice: 15.9,
        markupType: "fixed",
        markupValue: 3,
        finalPrice: 18.9,
        currency: "BGN",
        shippingDays: 1,
        shippingToBG: true,
        imageUrl: "https://picsum.photos/900?seed=coffee2",
        status: "approved",
        stockStatus: "in_stock",
        stockQty: 20,
        isActive: true,
        isFeatured: true,
        weight: 250,
        weightUnit: "g",
        roastLevel: "medium",
        intensity: 7,
        caffeineType: "regular",
        badges: ["Класика"],
        rating: 4.7,
        reviewsCount: 88,
      },
      {
        title: "Nespresso съвместими капсули – Intenso",
        shortDescription:
          "Капсули с плътен вкус и силен аромат за ежедневно кафе.",
        description:
          "Подходящи за бързо и удобно еспресо у дома или в офиса.",
        brand: "Caffe Market",
        category: "capsules",
        source: "manual",
        price: 12.5,
        basePrice: 9.9,
        markupType: "fixed",
        markupValue: 2.6,
        finalPrice: 12.5,
        currency: "BGN",
        shippingDays: 1,
        shippingToBG: true,
        imageUrl: "https://picsum.photos/900?seed=coffee3",
        status: "approved",
        stockStatus: "in_stock",
        stockQty: 30,
        isActive: true,
        isFeatured: true,
        packCount: 10,
        intensity: 10,
        compatibleWith: ["Nespresso"],
        badges: ["Съвместими капсули"],
        rating: 4.6,
        reviewsCount: 57,
      },
      {
        title: "Автоматична кафемашина DeLonghi Magnifica",
        shortDescription: "Компактна автоматична кафемашина за дома и офиса.",
        description:
          "Приготвя ароматно еспресо с удобни настройки и лесна поддръжка.",
        brand: "DeLonghi",
        category: "machines",
        source: "manual",
        price: 899,
        basePrice: 829,
        markupType: "fixed",
        markupValue: 70,
        finalPrice: 899,
        oldPrice: 949,
        currency: "BGN",
        shippingDays: 2,
        shippingToBG: true,
        imageUrl: "https://picsum.photos/900?seed=coffee4",
        status: "approved",
        stockStatus: "in_stock",
        stockQty: 4,
        isActive: true,
        isFeatured: true,
        isOnSale: true,
        badges: ["Промо", "Топ продукт"],
        rating: 4.9,
        reviewsCount: 39,
      },
      {
        title: "Сироп за кафе Ванилия 700 мл",
        shortDescription:
          "Класически сироп за кафе, капучино и десертни напитки.",
        description:
          "Подходящ за домашни напитки, барове, офиси и HoReCa обекти.",
        brand: "Monin",
        category: "syrups",
        source: "manual",
        price: 16.9,
        basePrice: 13.9,
        markupType: "fixed",
        markupValue: 3,
        finalPrice: 16.9,
        currency: "BGN",
        shippingDays: 1,
        shippingToBG: true,
        imageUrl: "https://picsum.photos/900?seed=coffee5",
        status: "approved",
        stockStatus: "in_stock",
        stockQty: 16,
        isActive: true,
        isFeatured: false,
        weight: 700,
        weightUnit: "ml",
        badges: ["Бариста избор"],
        rating: 4.5,
        reviewsCount: 21,
      },
    ];

    let created = 0;
    let skipped = 0;

    for (const item of demo) {
      try {
        const payload = buildProductPayload(item, req.user.id);
        const categoryMeta = await resolveCategoryMeta(item);

        payload.category = categoryMeta.category;
        payload.categoryId = categoryMeta.categoryId;
        payload.categoryPath = categoryMeta.categoryPath;
        payload.slug = await generateUniqueSlug(payload.title);

        await Product.create(payload);
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
 * - ?featured=true|false
 * - ?q=текст
 */
router.get("/products", auth, adminOnly, async (req, res) => {
  try {
    const { status, featured, q } = req.query || {};
    const page = Math.max(1, parseInt(req.query.page || "1", 10) || 1);
    const limitRaw = parseInt(req.query.limit || "200", 10) || 200;
    const limit = Math.max(1, Math.min(500, limitRaw));

    const query = {};

    if (status && status !== "all") {
      if (!ALLOWED_STATUS.includes(status)) {
        return res.status(400).json({ message: "Невалиден статус" });
      }
      query.status = status;
    }

    if (featured === "true") query.isFeatured = true;
    if (featured === "false") query.isFeatured = false;

    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim(), "i");
      query.$or = [
        { title: rx },
        { brand: rx },
        { sku: rx },
        { shortDescription: rx },
        { description: rx },
        { slug: rx },
      ];
    }

    const [items, total] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Product.countDocuments(query),
    ]);

    return res.json({ ok: true, items, total, page, limit });
  } catch (err) {
    return res.status(500).json({
      message: "Грешка в сървъра",
      error: err.message,
    });
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
    return res.status(500).json({
      message: "Грешка в сървъра",
      error: err.message,
    });
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

    const patch = buildProductPayload(data);

    if (data.title != null) patch.title = normalizeText(data.title);
    else delete patch.title;

    if (data.shortDescription == null) delete patch.shortDescription;
    if (data.description == null) delete patch.description;
    if (data.sku == null) delete patch.sku;
    if (data.brand == null) delete patch.brand;
    if (data.category == null) delete patch.category;
    if (data.source == null) delete patch.source;
    if (data.sourceUrl == null) delete patch.sourceUrl;
    if (data.imageUrl == null) delete patch.imageUrl;
    if (data.images == null) delete patch.images;
    if (data.currency == null) delete patch.currency;
    if (data.shippingPrice == null) delete patch.shippingPrice;
    if (data.shippingToBG == null) delete patch.shippingToBG;
    if (data.shippingDays == null) delete patch.shippingDays;
    if (data.stockStatus == null) delete patch.stockStatus;
    if (data.stockQty == null) delete patch.stockQty;
    if (data.isActive == null) delete patch.isActive;
    if (data.isFeatured == null) delete patch.isFeatured;
    if (data.status == null) delete patch.status;
    if (data.price == null && data.price !== "") delete patch.price;
    if (data.basePrice == null && data.basePrice !== "") delete patch.basePrice;
    if (data.markupValue == null && data.markupValue !== "") delete patch.markupValue;
    if (data.finalPrice == null && data.finalPrice !== "") delete patch.finalPrice;
    if (data.markupType == null) delete patch.markupType;

    if (data.weight == null) delete patch.weight;
    if (data.weightUnit == null) delete patch.weightUnit;
    if (data.packCount == null) delete patch.packCount;
    if (data.roastLevel == null) delete patch.roastLevel;
    if (data.intensity == null) delete patch.intensity;
    if (data.caffeineType == null) delete patch.caffeineType;
    if (data.compatibleWith == null) delete patch.compatibleWith;
    if (data.badges == null) delete patch.badges;
    if (data.isNew == null) delete patch.isNew;
    if (data.isOnSale == null) delete patch.isOnSale;
    if (data.oldPrice == null && data.oldPrice !== "") delete patch.oldPrice;
    if (data.rating == null && data.rating !== "") delete patch.rating;
    if (data.reviewsCount == null && data.reviewsCount !== "") {
      delete patch.reviewsCount;
    }

    const hasCategoryInput =
      data.category != null || data.categoryId != null || data.categoryPath != null;

    if (hasCategoryInput) {
      const categoryMeta = await resolveCategoryMeta(data);
      patch.category = categoryMeta.category;
      patch.categoryId = categoryMeta.categoryId;
      patch.categoryPath = categoryMeta.categoryPath;
    }

    if (data.title != null && normalizeText(data.title)) {
      patch.slug = await generateUniqueSlug(normalizeText(data.title), id);
    }

    const updated = await Product.findByIdAndUpdate(id, { $set: patch }, { new: true });
    if (!updated) return res.status(404).json({ message: "Не е намерен" });

    return res.json({ ok: true, product: updated });
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
    return res.status(500).json({
      message: "Грешка в сървъра",
      error: err.message,
    });
  }
});

/**
 * PATCH /admin/products/feature-many
 * Маркиране на избрани продукти като препоръчани
 */
router.patch("/products/feature-many", auth, adminOnly, async (req, res) => {
  try {
    const { ids, isFeatured } = req.body || {};

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids трябва да е непразен масив" });
    }

    if (typeof isFeatured !== "boolean") {
      return res.status(400).json({
        message: "isFeatured трябва да е boolean стойност",
      });
    }

    const r = await Product.updateMany(
      { _id: { $in: ids } },
      { $set: { isFeatured } }
    );

    return res.json({
      ok: true,
      isFeatured,
      matched: r.matchedCount ?? r.n,
      modified: r.modifiedCount ?? r.nModified,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Грешка в сървъра",
      error: err.message,
    });
  }
});

/**
 * DELETE /admin/products/delete-many
 * Изтриване на избрани продукти наведнъж
 */
router.delete("/products/delete-many", auth, adminOnly, async (req, res) => {
  try {
    const { ids } = req.body || {};

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        message: "ids трябва да е непразен масив",
      });
    }

    const validIds = ids
      .map((x) => String(x || "").trim())
      .filter((x) => isValidObjectId(x));

    if (validIds.length === 0) {
      return res.status(400).json({
        message: "Няма валидни ID за изтриване",
      });
    }

    const r = await Product.deleteMany({
      _id: { $in: validIds },
    });

    return res.json({
      ok: true,
      deleted: r.deletedCount ?? 0,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Грешка в сървъра",
      error: err.message,
    });
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
    return res.status(500).json({
      message: "Грешка в сървъра",
      error: err.message,
    });
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
    return res.status(500).json({
      message: "Грешка в сървъра",
      error: err.message,
    });
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
    return res.status(500).json({
      message: "Грешка в сървъра",
      error: err.message,
    });
  }
});

/**
 * POST /admin/categories/seed
 * Seed на главни категории за кафе магазин
 */
router.post("/categories/seed", auth, adminOnly, async (req, res) => {
  try {
    const existing = await Category.countDocuments();
    if (existing > 0) {
      return res.json({
        ok: true,
        message: "Категориите вече съществуват",
        count: existing,
      });
    }

    const now = new Date();

    function make({
      name,
      slug,
      path,
      level,
      parent = null,
      order = 0,
      icon = "",
      shortDescription = "",
      imageUrl = "",
      showOnHomepage = false,
      isFeatured = false,
    }) {
      return {
        name,
        slug,
        path,
        level,
        parent,
        order,
        isActive: true,
        icon,
        shortDescription,
        imageUrl,
        showOnHomepage,
        isFeatured,
        createdAt: now,
        updatedAt: now,
      };
    }

    const roots = await Category.insertMany([
      make({
        name: "Кафе",
        slug: "kafe",
        path: ["kafe"],
        level: 0,
        order: 1,
        icon: "☕",
        showOnHomepage: true,
        isFeatured: true,
      }),
      make({
        name: "Кафемашини",
        slug: "kafemashini",
        path: ["kafemashini"],
        level: 0,
        order: 2,
        icon: "☕",
        showOnHomepage: true,
        isFeatured: true,
      }),
      make({
        name: "Аксесоари",
        slug: "aksesoari",
        path: ["aksesoari"],
        level: 0,
        order: 3,
        icon: "🧋",
        showOnHomepage: true,
        isFeatured: true,
      }),
      make({
        name: "Сиропи и добавки",
        slug: "siropi-i-dobavki",
        path: ["siropi-i-dobavki"],
        level: 0,
        order: 4,
        icon: "🍯",
        showOnHomepage: true,
        isFeatured: false,
      }),
      make({
        name: "Офис и HoReCa",
        slug: "ofis-i-horeca",
        path: ["ofis-i-horeca"],
        level: 0,
        order: 5,
        icon: "🏢",
        showOnHomepage: true,
        isFeatured: true,
      }),
    ]);

    const rootBySlug = {};
    for (const r of roots) rootBySlug[r.slug] = r;

    const lvl1 = await Category.insertMany([
      make({
        name: "Кафе на зърна",
        slug: "kafe-na-zarna",
        path: ["kafe", "kafe-na-zarna"],
        level: 1,
        parent: rootBySlug.kafe._id,
        order: 1,
        showOnHomepage: true,
      }),
      make({
        name: "Мляно кафе",
        slug: "mlyano-kafe",
        path: ["kafe", "mlyano-kafe"],
        level: 1,
        parent: rootBySlug.kafe._id,
        order: 2,
        showOnHomepage: true,
      }),
      make({
        name: "Капсули",
        slug: "kapsuli",
        path: ["kafe", "kapsuli"],
        level: 1,
        parent: rootBySlug.kafe._id,
        order: 3,
        showOnHomepage: true,
      }),
      make({
        name: "Дози и Pods",
        slug: "dozi-i-pods",
        path: ["kafe", "dozi-i-pods"],
        level: 1,
        parent: rootBySlug.kafe._id,
        order: 4,
      }),
      make({
        name: "Автоматични кафемашини",
        slug: "avtomatichni-kafemashini",
        path: ["kafemashini", "avtomatichni-kafemashini"],
        level: 1,
        parent: rootBySlug.kafemashini._id,
        order: 1,
      }),
      make({
        name: "Капсулни машини",
        slug: "kapsulni-mashini",
        path: ["kafemashini", "kapsulni-mashini"],
        level: 1,
        parent: rootBySlug.kafemashini._id,
        order: 2,
      }),
      make({
        name: "Професионални машини",
        slug: "profesionalni-mashini",
        path: ["kafemashini", "profesionalni-mashini"],
        level: 1,
        parent: rootBySlug.kafemashini._id,
        order: 3,
      }),
      make({
        name: "Чаши и термоси",
        slug: "chashi-i-termosi",
        path: ["aksesoari", "chashi-i-termosi"],
        level: 1,
        parent: rootBySlug.aksesoari._id,
        order: 1,
      }),
      make({
        name: "Мелачки",
        slug: "melachki",
        path: ["aksesoari", "melachki"],
        level: 1,
        parent: rootBySlug.aksesoari._id,
        order: 2,
      }),
      make({
        name: "Бариста аксесоари",
        slug: "barista-aksesoari",
        path: ["aksesoari", "barista-aksesoari"],
        level: 1,
        parent: rootBySlug.aksesoari._id,
        order: 3,
      }),
      make({
        name: "Сиропи",
        slug: "siropi",
        path: ["siropi-i-dobavki", "siropi"],
        level: 1,
        parent: rootBySlug["siropi-i-dobavki"]._id,
        order: 1,
      }),
      make({
        name: "Подсладители",
        slug: "podsladiteli",
        path: ["siropi-i-dobavki", "podsladiteli"],
        level: 1,
        parent: rootBySlug["siropi-i-dobavki"]._id,
        order: 2,
      }),
      make({
        name: "Кафе за офиси",
        slug: "kafe-za-ofisi",
        path: ["ofis-i-horeca", "kafe-za-ofisi"],
        level: 1,
        parent: rootBySlug["ofis-i-horeca"]._id,
        order: 1,
      }),
      make({
        name: "Кафе за хотели",
        slug: "kafe-za-hoteli",
        path: ["ofis-i-horeca", "kafe-za-hoteli"],
        level: 1,
        parent: rootBySlug["ofis-i-horeca"]._id,
        order: 2,
      }),
      make({
        name: "Вендинг",
        slug: "vending",
        path: ["ofis-i-horeca", "vending"],
        level: 1,
        parent: rootBySlug["ofis-i-horeca"]._id,
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