// models/Category.js
const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },

    // ✅ hierarchical path: ["home","kitchen","cookware"]
    path: { type: [String], default: [], index: true },

    level: { type: Number, default: 0, index: true },
    order: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// unique slug per parent
CategorySchema.index({ parent: 1, slug: 1 }, { unique: true });

// ✅ unique full path (only when path exists)
CategorySchema.index({ path: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Category", CategorySchema);
