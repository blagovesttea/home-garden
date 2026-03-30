// routes/categories.js
const express = require("express");
const Category = require("../models/Category");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");

const router = express.Router();

function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * POST /categories/seed
 * Seed за кафе магазин
 */
router.post("/seed", auth, adminOnly, async (req, res) => {
  try {
    const seed = [
      {
        name: "Кафе",
        icon: "☕",
        showOnHomepage: true,
        isFeatured: true,
        children: [
          {
            name: "Кафе на зърна",
            icon: "🫘",
            showOnHomepage: true,
            children: [
              { name: "100% Арабика" },
              { name: "Бленд" },
              { name: "Италианско кафе" },
              { name: "Специално кафе" },
              { name: "Био кафе" },
            ],
          },
          {
            name: "Мляно кафе",
            icon: "☕",
            showOnHomepage: true,
            children: [
              { name: "Еспресо" },
              { name: "Филтър кафе" },
              { name: "Турско кафе" },
              { name: "Кафе за джезве" },
            ],
          },
          {
            name: "Капсули",
            icon: "🟤",
            showOnHomepage: true,
            children: [
              { name: "Nespresso" },
              { name: "Dolce Gusto" },
              { name: "Lavazza" },
              { name: "illy" },
            ],
          },
          {
            name: "Дози и Pods",
            icon: "📦",
            children: [
              { name: "Хартиени дози" },
              { name: "ESE Pods" },
              { name: "Професионални дози" },
            ],
          },
        ],
      },
      {
        name: "Кафемашини",
        icon: "☕",
        showOnHomepage: true,
        isFeatured: true,
        children: [
          {
            name: "Автоматични кафемашини",
            children: [
              { name: "DeLonghi" },
              { name: "Saeco" },
              { name: "Philips" },
              { name: "Krups" },
            ],
          },
          {
            name: "Капсулни машини",
            children: [
              { name: "Nespresso машини" },
              { name: "Dolce Gusto машини" },
              { name: "Lavazza машини" },
            ],
          },
          {
            name: "Професионални машини",
            children: [
              { name: "За офиси" },
              { name: "За заведения" },
              { name: "За хотели" },
            ],
          },
          {
            name: "Ръчни еспресо машини",
            children: [
              { name: "Домашни" },
              { name: "Премиум" },
            ],
          },
        ],
      },
      {
        name: "Аксесоари",
        icon: "🧋",
        showOnHomepage: true,
        children: [
          {
            name: "Чаши и термоси",
            children: [
              { name: "Стъклени чаши" },
              { name: "Термочаши" },
              { name: "Порцеланови чаши" },
            ],
          },
          {
            name: "Мелачки",
            children: [
              { name: "Ръчни мелачки" },
              { name: "Електрически мелачки" },
            ],
          },
          {
            name: "Почистващи препарати",
            children: [
              { name: "За кафемашини" },
              { name: "Декалциране" },
              { name: "Филтри за вода" },
            ],
          },
          {
            name: "Бариста аксесоари",
            children: [
              { name: "Тампери" },
              { name: "Кани за мляко" },
              { name: "Шейкъри" },
            ],
          },
        ],
      },
      {
        name: "Сиропи и добавки",
        icon: "🍯",
        showOnHomepage: true,
        children: [
          {
            name: "Сиропи",
            children: [
              { name: "Ванилия" },
              { name: "Карамел" },
              { name: "Лешник" },
              { name: "Шоколад" },
            ],
          },
          {
            name: "Подсладители",
            children: [
              { name: "Кафява захар" },
              { name: "Стевия" },
              { name: "Подсладители" },
            ],
          },
          {
            name: "Млека и сметани",
            children: [
              { name: "Растителни млека" },
              { name: "Кондензирано мляко" },
            ],
          },
        ],
      },
      {
        name: "Офис и HoReCa",
        icon: "🏢",
        showOnHomepage: true,
        isFeatured: true,
        children: [
          {
            name: "Кафе за офиси",
            children: [
              { name: "Абонаменти" },
              { name: "Пакети за офиси" },
            ],
          },
          {
            name: "Кафе за хотели",
            children: [
              { name: "Хотелски пакети" },
              { name: "Мини бар решения" },
            ],
          },
          {
            name: "Кафе за ресторанти",
            children: [
              { name: "Професионални смеси" },
              { name: "Бар решения" },
            ],
          },
          {
            name: "Вендинг",
            children: [
              { name: "Вендинг кафе" },
              { name: "Консумативи" },
            ],
          },
        ],
      },
    ];

    async function upsertNode(node, parentDoc, order) {
      const name = String(node.name || "").trim();
      const slug = slugify(name) || `cat-${order || 0}`;

      const parentId = parentDoc ? parentDoc._id : null;
      const level = parentDoc ? Number(parentDoc.level || 0) + 1 : 0;

      const parentPath = parentDoc
        ? Array.isArray(parentDoc.path)
          ? parentDoc.path
          : []
        : [];

      const path = [...parentPath, slug];

      const doc = await Category.findOneAndUpdate(
        { parent: parentId, slug },
        {
          $set: {
            name,
            slug,
            parent: parentId,
            level,
            order: Number(order || 0),
            isActive: true,
            path,
            icon: node.icon || "",
            shortDescription: node.shortDescription || "",
            imageUrl: node.imageUrl || "",
            showOnHomepage: Boolean(node.showOnHomepage),
            isFeatured: Boolean(node.isFeatured),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const kids = Array.isArray(node.children) ? node.children : [];
      for (let i = 0; i < kids.length; i++) {
        await upsertNode(kids[i], doc, i);
      }

      return doc;
    }

    for (let i = 0; i < seed.length; i++) {
      await upsertNode(seed[i], null, i);
    }

    const count = await Category.countDocuments({});
    return res.json({
      ok: true,
      message: "Категориите са добавени успешно",
      count,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Грешка при добавяне на категориите",
      error: err.message,
    });
  }
});

/**
 * GET /categories
 * Tree structure for menu
 */
router.get("/", async (req, res) => {
  try {
    const items = await Category.find({ isActive: true })
      .sort({ level: 1, order: 1, name: 1 })
      .lean();

    const byId = new Map();
    const roots = [];

    for (const c of items) {
      byId.set(String(c._id), {
        _id: c._id,
        name: c.name,
        slug: c.slug,
        path: c.path || [],
        level: c.level,
        parent: c.parent || null,
        icon: c.icon || "",
        shortDescription: c.shortDescription || "",
        imageUrl: c.imageUrl || "",
        showOnHomepage: c.showOnHomepage || false,
        isFeatured: c.isFeatured || false,
        children: [],
      });
    }

    for (const c of items) {
      const node = byId.get(String(c._id));
      if (c.parent) {
        const parent = byId.get(String(c.parent));
        if (parent) parent.children.push(node);
        else roots.push(node);
      } else {
        roots.push(node);
      }
    }

    return res.json({ ok: true, items: roots });
  } catch (err) {
    return res.status(500).json({
      message: "Грешка в сървъра",
      error: err.message,
    });
  }
});

/**
 * GET /categories/flat
 */
router.get("/flat", async (req, res) => {
  try {
    const items = await Category.find({ isActive: true })
      .sort({ level: 1, order: 1, name: 1 })
      .lean();

    return res.json({ ok: true, items });
  } catch (err) {
    return res.status(500).json({
      message: "Грешка в сървъра",
      error: err.message,
    });
  }
});

/**
 * GET /categories/by-path?path=kafe/kafe-na-zarna/100-arabika
 */
router.get("/by-path", async (req, res) => {
  try {
    const pathStr = String(req.query.path || "").trim();

    if (!pathStr) {
      return res.status(400).json({
        message: "Липсва path параметър",
      });
    }

    const pathArr = pathStr
      .split("/")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const item = await Category.findOne({
      path: pathArr,
      isActive: true,
    }).lean();

    if (!item) {
      return res.status(404).json({
        message: "Категорията не е намерена",
      });
    }

    return res.json({ ok: true, item });
  } catch (err) {
    return res.status(500).json({
      message: "Грешка в сървъра",
      error: err.message,
    });
  }
});

module.exports = router;