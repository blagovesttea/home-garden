require("dotenv").config();
const mongoose = require("mongoose");
const Category = require("../models/Category");

const MONGO =
  process.env.MONGO_URI ||
  process.env.MONGO_URL ||
  process.env.MONGODB_URI;

if (!MONGO) {
  console.error("❌ Missing MONGO_URI in env");
  process.exit(1);
}

function slugify(s = "") {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9а-я\s-]/gi, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function upsertCategory({
  name,
  slug,
  parent = null,
  order = 0,
  path = [],
  level = 0,
}) {
  const cleanSlug = slugify(slug || name);
  const parentId = parent?._id || null;

  const doc = await Category.findOneAndUpdate(
    { parent: parentId, slug: cleanSlug },
    {
      $set: {
        name,
        slug: cleanSlug,
        parent: parentId,
        order,
        level,
        path,
        isActive: true,
      },
    },
    { upsert: true, new: true }
  );

  return doc;
}

async function seedTree(rootName, rootSlug, children) {
  const root = await upsertCategory({
    name: rootName,
    slug: rootSlug,
    parent: null,
    order: 0,
    level: 0,
    path: [rootSlug],
  });

  let i = 1;
  for (const c of children) {
    const child = await upsertCategory({
      name: c.name,
      slug: c.slug,
      parent: root,
      order: c.order ?? i++,
      level: 1,
      path: [rootSlug, c.slug],
    });

    if (Array.isArray(c.children)) {
      let j = 1;
      for (const s of c.children) {
        await upsertCategory({
          name: s.name,
          slug: s.slug,
          parent: child,
          order: s.order ?? j++,
          level: 2,
          path: [rootSlug, c.slug, s.slug],
        });
      }
    }
  }
}

async function run() {
  await mongoose.connect(MONGO);
  console.log("✅ Mongo connected");

  const HOME = [
    {
      name: "Кухня и хранене",
      slug: "kitchen",
      children: [
        { name: "Съдове за готвене", slug: "cookware" },
        { name: "Съдове за печене", slug: "bakeware" },
        { name: "Кухненски инструменти", slug: "kitchen-tools" },
        { name: "Ножове и дъски", slug: "knives" },
        { name: "Кутии за храна", slug: "food-storage" },
        { name: "Малки електроуреди", slug: "small-appliances" },
        { name: "Сервизи и прибори", slug: "tableware" },
        { name: "Чаши и термоси", slug: "drinkware" },
      ],
    },
    {
      name: "Почистване",
      slug: "cleaning",
      children: [
        { name: "Мопове и метли", slug: "mops" },
        { name: "Инструменти за почистване", slug: "cleaning-tools" },
        { name: "Гъби и кърпи", slug: "sponges" },
        { name: "Кофи и легенчета", slug: "buckets" },
      ],
    },
    {
      name: "Съхранение и организация",
      slug: "storage",
      children: [
        { name: "Кутии и органайзери", slug: "boxes" },
        { name: "Органайзери за чекмеджета", slug: "drawer-organizers" },
        { name: "Органайзери за гардероб", slug: "wardrobe" },
        { name: "Етажерки и стелажи", slug: "shelving" },
        { name: "Закачалки", slug: "hangers" },
      ],
    },
    {
      name: "Декорация за дома",
      slug: "decor",
      children: [
        { name: "Декорация за стена", slug: "wall-decor" },
        { name: "Огледала", slug: "mirrors" },
        { name: "Свещи", slug: "candles" },
        { name: "Часовници", slug: "clocks" },
      ],
    },
    {
      name: "Осветление",
      slug: "lighting",
      children: [
        { name: "Таванни лампи", slug: "ceiling" },
        { name: "Настолни лампи", slug: "table-lamps" },
        { name: "Подови лампи", slug: "floor-lamps" },
        { name: "LED осветление", slug: "led" },
      ],
    },
    {
      name: "Баня",
      slug: "bathroom",
      children: [
        { name: "Аксесоари за душ", slug: "shower" },
        { name: "Постелки за баня", slug: "bath-mats" },
        { name: "Съхранение за баня", slug: "bathroom-storage" },
      ],
    },
    {
      name: "Спалня",
      slug: "bedroom",
      children: [
        { name: "Спално бельо", slug: "bedding" },
        { name: "Възглавници", slug: "pillows" },
        { name: "Одеяла", slug: "blankets" },
      ],
    },
    {
      name: "Ремонти и подобрения",
      slug: "improvement",
      children: [
        { name: "Крепежи и обков", slug: "hardware" },
        { name: "Лепила и силикони", slug: "adhesives" },
        { name: "Инструменти и измерване", slug: "measuring" },
      ],
    },
  ];

  const GARDEN = [
    {
      name: "Растения и отглеждане",
      slug: "plants",
      children: [
        { name: "Семена", slug: "seeds" },
        { name: "Почва и торове", slug: "soil" },
        { name: "Саксии и кашпи", slug: "pots" },
      ],
    },
    {
      name: "Поливане и напояване",
      slug: "irrigation",
      children: [
        { name: "Маркучи", slug: "hoses" },
        { name: "Разпръсквачи", slug: "sprinklers" },
        { name: "Капково напояване", slug: "drip" },
      ],
    },
    {
      name: "Градински инструменти",
      slug: "tools",
      children: [
        { name: "Ръчни инструменти", slug: "hand-tools" },
        { name: "Електроинструменти", slug: "power-tools" },
        { name: "Ръкавици", slug: "gloves" },
      ],
    },
    {
      name: "Двор и отдих",
      slug: "outdoor",
      children: [
        { name: "Градински мебели", slug: "furniture" },
        { name: "Чадъри и сенници", slug: "umbrellas" },
        { name: "Хамаци", slug: "hammocks" },
      ],
    },
    {
      name: "Барбекю и готвене",
      slug: "bbq",
      children: [
        { name: "Скари", slug: "grills" },
        { name: "Аксесоари за BBQ", slug: "bbq-accessories" },
      ],
    },
    {
      name: "Градинско осветление и декор",
      slug: "garden-decor",
      children: [
        { name: "Соларни лампи", slug: "solar" },
        { name: "Градински фигури", slug: "statues" },
      ],
    },
  ];

  await seedTree("Дом", "home", HOME);
  await seedTree("Градина", "garden", GARDEN);

  console.log("✅ Categories seeded");
  await mongoose.disconnect();
  console.log("✅ Done");
}

run().catch((e) => {
  console.error("❌ Seed error:", e);
  process.exit(1);
});