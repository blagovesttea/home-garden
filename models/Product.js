const mongoose = require("mongoose");

const PRODUCT_CATEGORIES = [
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

function slugifyProductTitle(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .trim();
}

const ProductSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    slug: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      index: true,
      unique: true,
      sparse: true,
    },

    shortDescription: {
      type: String,
      default: "",
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    sku: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    brand: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    /**
     * Главна магазинна категория
     */
    category: {
      type: String,
      required: true,
      enum: PRODUCT_CATEGORIES,
      default: "coffee-beans",
      index: true,
    },

    /**
     * Каталог / дърво с категории
     */
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },

    categoryPath: {
      type: [String],
      default: [],
      index: true,
    },

    categoryLocked: {
      type: Boolean,
      default: false,
      index: true,
    },

    /**
     * Данни за продукта – полезни за кафе магазин
     */
    weight: {
      type: Number,
      default: null,
      min: 0,
    },

    weightUnit: {
      type: String,
      enum: ["g", "kg", "ml", "l", "pcs", ""],
      default: "",
    },

    packCount: {
      type: Number,
      default: null,
      min: 0,
    },

    roastLevel: {
      type: String,
      enum: ["", "light", "medium", "medium-dark", "dark"],
      default: "",
      index: true,
    },

    intensity: {
      type: Number,
      default: null,
      min: 1,
      max: 12,
    },

    caffeineType: {
      type: String,
      enum: ["", "regular", "decaf"],
      default: "",
      index: true,
    },

    compatibleWith: {
      type: [String],
      default: [],
    },

    /**
     * Баджове за UI
     */
    badges: {
      type: [String],
      default: [],
    },

    isNew: {
      type: Boolean,
      default: false,
      index: true,
    },

    isOnSale: {
      type: Boolean,
      default: false,
      index: true,
    },

    /**
     * Source info
     */
    source: {
      type: String,
      default: "manual",
      index: true,
    },

    sourceUrl: {
      type: String,
      default: "",
      index: true,
    },

    affiliateUrl: {
      type: String,
      default: "",
    },

    /**
     * Снимки
     */
    imageUrl: {
      type: String,
      default: "",
      trim: true,
    },

    images: {
      type: [String],
      default: [],
    },

    /**
     * Pricing
     */
    price: {
      type: Number,
      default: null,
      min: 0,
    },

    currency: {
      type: String,
      default: "BGN",
      trim: true,
    },

    shippingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    shippingToBG: {
      type: Boolean,
      default: true,
    },

    shippingDays: {
      type: Number,
      default: null,
      min: 0,
    },

    /**
     * Store pricing
     */
    basePrice: {
      type: Number,
      default: null,
      min: 0,
    },

    oldPrice: {
      type: Number,
      default: null,
      min: 0,
    },

    markupType: {
      type: String,
      enum: ["none", "percent", "fixed"],
      default: "none",
    },

    markupValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    finalPrice: {
      type: Number,
      default: null,
      min: 0,
    },

    /**
     * Stock
     */
    stockStatus: {
      type: String,
      enum: ["unknown", "in_stock", "out_of_stock"],
      default: "unknown",
      index: true,
    },

    stockQty: {
      type: Number,
      default: null,
      min: 0,
    },

    /**
     * Рейтинг / ревюта
     */
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    reviewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Store flags
     */
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },

    /**
     * Analytics
     */
    views: {
      type: Number,
      default: 0,
      min: 0,
    },

    clicks: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Legacy scoring – оставяме го,
     * за да не счупим стар код.
     */
    profitScore: {
      type: Number,
      default: 0,
    },

    score: {
      type: Number,
      default: 0,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    /**
     * Legacy BG check – оставяме го,
     * но вече не е ключово.
     */
    bg: {
      foundInBG: {
        type: String,
        enum: ["yes", "no", "unknown"],
        default: "unknown",
      },
      bestBGPrice: { type: Number, default: null },
      bgUrls: { type: [String], default: [] },
    },

    /**
     * Workflow
     */
    status: {
      type: String,
      enum: ["new", "approved", "rejected", "blacklisted"],
      default: "new",
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

ProductSchema.pre("validate", function (next) {
  const generatedSlug = slugifyProductTitle(this.title || "");

  if (!generatedSlug) {
    if (!this.slug) this.slug = "";
    return next();
  }

  if (!this.slug || this.isModified("title")) {
    this.slug = generatedSlug;
  } else {
    this.slug = slugifyProductTitle(this.slug);
  }

  next();
});

ProductSchema.index({ slug: 1 }, { unique: true, sparse: true });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ score: -1 });
ProductSchema.index({ profitScore: -1 });
ProductSchema.index({ categoryPath: 1 });
ProductSchema.index({ status: 1, categoryPath: 1 });
ProductSchema.index({ isActive: 1, isFeatured: 1 });
ProductSchema.index({ brand: 1, sku: 1 });
ProductSchema.index({ category: 1, status: 1, isActive: 1 });
ProductSchema.index({ isOnSale: 1, oldPrice: -1, finalPrice: 1 });
ProductSchema.index({ isNew: 1, createdAt: -1 });
ProductSchema.index({ rating: -1, reviewsCount: -1 });
ProductSchema.index({ roastLevel: 1, caffeineType: 1 });

module.exports = mongoose.model("Product", ProductSchema);