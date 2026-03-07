const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },

    shortDescription: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },

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
     * Legacy simple category
     */
    category: {
      type: String,
      required: true,
      enum: ["home", "garden", "tools", "outdoor", "kitchen", "storage", "other"],
      default: "other",
      index: true,
    },

    /**
     * Catalog category
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
     * Source info
     * Оставяме го, защото може още да вкарваш продукти от външен source.
     */
    source: {
      type: String,
      default: "manual",
      index: true,
    },

    /**
     * Вече НЕ е required и НЕ е unique,
     * защото за реален магазин не трябва всеки продукт да идва от affiliate/source url.
     */
    sourceUrl: {
      type: String,
      default: "",
      index: true,
    },

    /**
     * Legacy affiliate поле – оставяме го засега,
     * но вече не е основна логика.
     */
    affiliateUrl: {
      type: String,
      default: "",
    },

    imageUrl: { type: String, default: "" },

    images: {
      type: [String],
      default: [],
    },

    // pricing
    price: { type: Number, default: null },
    currency: { type: String, default: "BGN" },

    shippingPrice: { type: Number, default: 0 },
    shippingToBG: { type: Boolean, default: true },
    shippingDays: { type: Number, default: null },

    /**
     * Store pricing
     */
    basePrice: { type: Number, default: null },

    markupType: {
      type: String,
      enum: ["none", "percent", "fixed"],
      default: "none",
    },

    markupValue: { type: Number, default: 0 },

    finalPrice: { type: Number, default: null },

    /**
     * Stock
     */
    stockStatus: {
      type: String,
      enum: ["unknown", "in_stock", "out_of_stock"],
      default: "unknown",
      index: true,
    },

    stockQty: { type: Number, default: null },

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
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },

    /**
     * Legacy scoring – оставяме го засега,
     * за да не счупим стар код.
     */
    profitScore: { type: Number, default: 0 },
    score: { type: Number, default: 0 },

    notes: { type: String, default: "" },

    /**
     * Legacy BG check – оставяме го, но вече не е ключово.
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

ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ score: -1 });
ProductSchema.index({ profitScore: -1 });
ProductSchema.index({ categoryPath: 1 });
ProductSchema.index({ status: 1, categoryPath: 1 });
ProductSchema.index({ isActive: 1, isFeatured: 1 });
ProductSchema.index({ brand: 1, sku: 1 });

module.exports = mongoose.model("Product", ProductSchema);