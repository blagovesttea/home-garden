const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },

    /**
     * ✅ Legacy simple category (оставяме го да не чупим текущия код)
     * По-нататък ще го държим като fallback или ще го махнем, когато минем изцяло на Catalog.
     */
    category: {
      type: String,
      required: true,
      enum: ["home", "garden", "tools", "outdoor", "kitchen", "storage", "other"],
      default: "other",
      index: true,
    },

    /**
     * ✅ NEW: Catalog category (истински ecommerce)
     * categoryId -> сочи към Category (подкатегория)
     * categoryPath -> slug path за бързо филтриране: ["home","kitchen","cookware"]
     * categoryLocked -> ако admin я фиксира, ботът НЕ я променя
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

    // source info
    source: {
      type: String,
      default: "other", // ✅ махаме enum, за да приема profitshare, alleop и т.н.
      index: true,
    },

    sourceUrl: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // affiliate link
    affiliateUrl: {
      type: String,
      default: "",
    },

    imageUrl: { type: String, default: "" },

    // pricing
    price: { type: Number, default: null }, // ✅ вече не е required
    currency: { type: String, default: "EUR" },
    shippingPrice: { type: Number, default: 0 },
    shippingToBG: { type: Boolean, default: true },
    shippingDays: { type: Number, default: null },

    /**
     * ✅ Ecommerce-ready pricing (за истински магазин)
     * basePrice = цена от source (ако искаш да я пазиш отделно)
     * markupType/value = надценка
     * finalPrice = сметната крайна цена (за по-късно)
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
     * ✅ Ecommerce-ready stock (за по-късно)
     */
    stockStatus: {
      type: String,
      enum: ["unknown", "in_stock", "out_of_stock"],
      default: "unknown",
      index: true,
    },
    stockQty: { type: Number, default: null },

    // analytics
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },

    profitScore: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    notes: { type: String, default: "" },

    // BG check
    bg: {
      foundInBG: {
        type: String,
        enum: ["yes", "no", "unknown"],
        default: "unknown",
      },
      bestBGPrice: { type: Number, default: null },
      bgUrls: { type: [String], default: [] },
    },

    // workflow
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

// индекси
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ score: -1 });
ProductSchema.index({ profitScore: -1 });

// ✅ по-бързо филтриране по каталог
ProductSchema.index({ categoryPath: 1 });
ProductSchema.index({ status: 1, categoryPath: 1 });

module.exports = mongoose.model("Product", ProductSchema);
