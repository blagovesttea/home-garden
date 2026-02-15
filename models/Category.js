const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema(
  {
    // Display name
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // URL slug (kitchen, cookware, garden-tools)
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    // Parent category (null = root)
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },

    // Level in tree
    // 0 = root (Home, Garden)
    // 1 = sub (Kitchen, Tools)
    // 2 = sub-sub (Cookware, Power Tools)
    level: {
      type: Number,
      default: 0,
      index: true,
    },

    // Path for fast queries
    // Example: ["home", "kitchen", "cookware"]
    path: {
      type: [String],
      default: [],
      index: true,
    },

    // Sort order in menu
    order: {
      type: Number,
      default: 0,
      index: true,
    },

    // Active / hidden
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

/**
 * Unique slug per parent
 * Allows:
 * Home > Kitchen
 * Garden > Kitchen (if needed)
 */
CategorySchema.index({ parent: 1, slug: 1 }, { unique: true });

/**
 * Fast menu queries
 */
CategorySchema.index({ level: 1, order: 1 });
CategorySchema.index({ path: 1 });

module.exports = mongoose.model("Category", CategorySchema);
