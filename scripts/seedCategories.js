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
      name: "Kitchen & Dining",
      slug: "kitchen",
      children: [
        { name: "Cookware", slug: "cookware" },
        { name: "Bakeware", slug: "bakeware" },
        { name: "Kitchen Tools", slug: "kitchen-tools" },
        { name: "Knives & Cutting", slug: "knives" },
        { name: "Food Storage", slug: "food-storage" },
        { name: "Small Appliances", slug: "small-appliances" },
        { name: "Tableware", slug: "tableware" },
        { name: "Drinkware", slug: "drinkware" },
      ],
    },
    {
      name: "Cleaning",
      slug: "cleaning",
      children: [
        { name: "Mops & Brooms", slug: "mops" },
        { name: "Cleaning Tools", slug: "cleaning-tools" },
        { name: "Sponges & Cloths", slug: "sponges" },
        { name: "Buckets", slug: "buckets" },
      ],
    },
    {
      name: "Storage & Organization",
      slug: "storage",
      children: [
        { name: "Boxes & Organizers", slug: "boxes" },
        { name: "Drawer Organizers", slug: "drawer-organizers" },
        { name: "Wardrobe Organizers", slug: "wardrobe" },
        { name: "Shelving & Racks", slug: "shelving" },
        { name: "Hangers", slug: "hangers" },
      ],
    },
    {
      name: "Home Decor",
      slug: "decor",
      children: [
        { name: "Wall Decor", slug: "wall-decor" },
        { name: "Mirrors", slug: "mirrors" },
        { name: "Candles", slug: "candles" },
        { name: "Clocks", slug: "clocks" },
      ],
    },
    {
      name: "Lighting",
      slug: "lighting",
      children: [
        { name: "Ceiling Lights", slug: "ceiling" },
        { name: "Table Lamps", slug: "table-lamps" },
        { name: "Floor Lamps", slug: "floor-lamps" },
        { name: "LED", slug: "led" },
      ],
    },
    {
      name: "Bathroom",
      slug: "bathroom",
      children: [
        { name: "Shower Accessories", slug: "shower" },
        { name: "Bath Mats", slug: "bath-mats" },
        { name: "Bathroom Storage", slug: "bathroom-storage" },
      ],
    },
    {
      name: "Bedroom",
      slug: "bedroom",
      children: [
        { name: "Bedding", slug: "bedding" },
        { name: "Pillows", slug: "pillows" },
        { name: "Blankets", slug: "blankets" },
      ],
    },
    {
      name: "Home Improvement",
      slug: "improvement",
      children: [
        { name: "Hardware", slug: "hardware" },
        { name: "Adhesives", slug: "adhesives" },
        { name: "Tools & Measuring", slug: "measuring" },
      ],
    },
  ];

  const GARDEN = [
    {
      name: "Plants & Growing",
      slug: "plants",
      children: [
        { name: "Seeds", slug: "seeds" },
        { name: "Soil & Fertilizers", slug: "soil" },
        { name: "Pots & Planters", slug: "pots" },
      ],
    },
    {
      name: "Watering & Irrigation",
      slug: "irrigation",
      children: [
        { name: "Hoses", slug: "hoses" },
        { name: "Sprinklers", slug: "sprinklers" },
        { name: "Drip Irrigation", slug: "drip" },
      ],
    },
    {
      name: "Garden Tools",
      slug: "tools",
      children: [
        { name: "Hand Tools", slug: "hand-tools" },
        { name: "Power Tools", slug: "power-tools" },
        { name: "Gloves", slug: "gloves" },
      ],
    },
    {
      name: "Outdoor Living",
      slug: "outdoor",
      children: [
        { name: "Outdoor Furniture", slug: "furniture" },
        { name: "Umbrellas & Shades", slug: "umbrellas" },
        { name: "Hammocks", slug: "hammocks" },
      ],
    },
    {
      name: "BBQ & Cooking",
      slug: "bbq",
      children: [
        { name: "Grills", slug: "grills" },
        { name: "BBQ Accessories", slug: "bbq-accessories" },
      ],
    },
    {
      name: "Garden Lighting & Decor",
      slug: "garden-decor",
      children: [
        { name: "Solar Lights", slug: "solar" },
        { name: "Garden Statues", slug: "statues" },
      ],
    },
  ];

  await seedTree("Home", "home", HOME);
  await seedTree("Garden", "garden", GARDEN);

  console.log("✅ Categories seeded");
  await mongoose.disconnect();
  console.log("✅ Done");
}

run().catch((e) => {
  console.error("❌ Seed error:", e);
  process.exit(1);
});
