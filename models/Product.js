const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },

    category: {
      type: String,
      required: true,
      enum: ["home", "garden", "tools", "outdoor", "kitchen", "storage", "other"],
      default: "other",
      index: true,
    },

    // source info
    source: {
      type: String,
      default: "other", // ✅ махаме enum, за да приема profitshare, alleop и т.н.
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

module.exports = mongoose.model("Product", ProductSchema);
