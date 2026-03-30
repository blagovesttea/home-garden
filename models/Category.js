// models/Category.js
const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema(
  {
    /**
     * Име на категорията на български
     * Пример: "Кафе на зърна"
     */
    name: {
      type: String,
      required: true,
      trim: true,
    },

    /**
     * URL slug
     * Пример: "kafe-na-zarna"
     */
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    /**
     * Родителска категория
     * Пример:
     * Кафе -> Кафе на зърна
     */
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },

    /**
     * Йерархичен path
     * Пример:
     * ["кафе", "кафе-на-зърна"]
     */
    path: {
      type: [String],
      default: [],
      index: true,
    },

    /**
     * Ниво в дървото
     * 0 = главна категория
     * 1 = подкатегория
     * 2 = под-подкатегория
     */
    level: {
      type: Number,
      default: 0,
      index: true,
    },

    /**
     * Подредба в менюто
     */
    order: {
      type: Number,
      default: 0,
      index: true,
    },

    /**
     * Активна / скрита категория
     */
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    /**
     * Иконка или emoji за категорията
     * Пример: "☕"
     */
    icon: {
      type: String,
      default: "",
      trim: true,
    },

    /**
     * Кратко описание за category cards / SEO
     */
    shortDescription: {
      type: String,
      default: "",
      trim: true,
    },

    /**
     * Изображение за category banner/card
     */
    imageUrl: {
      type: String,
      default: "",
      trim: true,
    },

    /**
     * Дали категорията да се показва в началната страница
     */
    showOnHomepage: {
      type: Boolean,
      default: false,
      index: true,
    },

    /**
     * Дали категорията е highlighted / featured
     */
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// unique slug per parent
CategorySchema.index({ parent: 1, slug: 1 }, { unique: true });

// unique full path
CategorySchema.index({ path: 1 }, { unique: true, sparse: true });

// useful listing indexes
CategorySchema.index({ isActive: 1, order: 1 });
CategorySchema.index({ showOnHomepage: 1, isFeatured: 1 });

module.exports = mongoose.model("Category", CategorySchema);