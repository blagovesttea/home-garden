// services/categorizer.js
const Category = require("../models/Category");

function norm(s = "") {
  return String(s || "")
    .toLowerCase()
    .replace(/['"]/g, " ")
    .replace(/[^a-z0-9а-яё\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countHits(text, keywords = []) {
  let score = 0;

  for (const kw of keywords) {
    const k = norm(kw);
    if (!k) continue;

    const re = new RegExp(
      `(^|\\s)${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`,
      "i"
    );

    if (re.test(text)) score += 4;
    if (text.includes(k)) score += 1;
  }

  return score;
}

/**
 * Match rules -> categoryPath
 * IMPORTANT:
 * These paths must exist in your coffee categories seed.
 */
const RULES = [
  // =========================
  // КАФЕ
  // =========================
  {
    path: ["kafe", "kafe-na-zarna"],
    keywords: [
      "кафе на зърна",
      "зърна",
      "beans",
      "coffee beans",
      "arabica beans",
      "robusta beans",
      "espresso beans",
      "lavazza oro",
      "зерна",
    ],
    weight: 12,
  },
  {
    path: ["kafe", "mlyano-kafe"],
    keywords: [
      "мляно кафе",
      "ground coffee",
      "смляно кафе",
      "кафе за джезве",
      "турско кафе",
      "filter coffee",
      "espresso ground",
    ],
    weight: 12,
  },
  {
    path: ["kafe", "kapsuli"],
    keywords: [
      "капсули",
      "capsules",
      "nespresso",
      "dolce gusto",
      "lavazza capsule",
      "illy capsule",
      "coffee capsule",
      "капсула за кафе",
    ],
    weight: 13,
  },
  {
    path: ["kafe", "dozi-i-pods"],
    keywords: [
      "pods",
      "pod",
      "ese pod",
      "дози",
      "хартиени дози",
      "кафе дози",
      "coffee pods",
      "paper pods",
    ],
    weight: 11,
  },

  // =========================
  // КАФЕМАШИНИ
  // =========================
  {
    path: ["kafemashini", "avtomatichni-kafemashini"],
    keywords: [
      "автоматична кафемашина",
      "автоматична машина",
      "automatic coffee machine",
      "bean to cup",
      "delonghi magnifica",
      "saeco",
      "philips lattego",
      "krups automatic",
    ],
    weight: 15,
  },
  {
    path: ["kafemashini", "kapsulni-mashini"],
    keywords: [
      "капсулна машина",
      "капсулна кафемашина",
      "capsule machine",
      "nespresso machine",
      "dolce gusto machine",
      "lavazza machine",
    ],
    weight: 14,
  },
  {
    path: ["kafemashini", "profesionalni-mashini"],
    keywords: [
      "професионална кафемашина",
      "professional coffee machine",
      "espresso machine",
      "bar machine",
      "horeca machine",
      "двугрупова машина",
      "едногрупова машина",
      "coffee machine for office",
    ],
    weight: 15,
  },

  // =========================
  // АКСЕСОАРИ
  // =========================
  {
    path: ["aksesoari", "chashi-i-termosi"],
    keywords: [
      "чаша",
      "чаши",
      "термочаша",
      "термос",
      "coffee cup",
      "mug",
      "travel mug",
      "glass cup",
      "espresso cup",
    ],
    weight: 11,
  },
  {
    path: ["aksesoari", "melachki"],
    keywords: [
      "мелачка",
      "мелачки",
      "grinder",
      "coffee grinder",
      "ръчна мелачка",
      "електрическа мелачка",
      "burr grinder",
    ],
    weight: 13,
  },
  {
    path: ["aksesoari", "barista-aksesoari"],
    keywords: [
      "тампер",
      "tamper",
      "milk pitcher",
      "кана за мляко",
      "barista",
      "barista accessories",
      "knock box",
      "portafilter",
      "дозатор за кафе",
      "шот чаша",
    ],
    weight: 12,
  },

  // =========================
  // СИРОПИ И ДОБАВКИ
  // =========================
  {
    path: ["siropi-i-dobavki", "siropi"],
    keywords: [
      "сироп",
      "сиропи",
      "vanilla syrup",
      "caramel syrup",
      "hazelnut syrup",
      "chocolate syrup",
      "monin",
      "coffee syrup",
    ],
    weight: 12,
  },
  {
    path: ["siropi-i-dobavki", "podsladiteli"],
    keywords: [
      "подсладител",
      "подсладители",
      "stevia",
      "захар",
      "кафява захар",
      "sweetener",
      "sugar sticks",
    ],
    weight: 10,
  },

  // =========================
  // ОФИС / HORECA
  // =========================
  {
    path: ["ofis-i-horeca", "kafe-za-ofisi"],
    keywords: [
      "office coffee",
      "кафе за офис",
      "офис кафе",
      "office beans",
      "office capsules",
      "абонамент за кафе",
    ],
    weight: 13,
  },
  {
    path: ["ofis-i-horeca", "kafe-za-hoteli"],
    keywords: [
      "hotel coffee",
      "кафе за хотели",
      "hotel capsules",
      "hotel coffee setup",
      "минибар кафе",
    ],
    weight: 13,
  },
  {
    path: ["ofis-i-horeca", "vending"],
    keywords: [
      "vending",
      "вендинг",
      "вендинг кафе",
      "vending coffee",
      "instant vending",
      "вендинг консумативи",
    ],
    weight: 12,
  },
];

function legacyFromPath(pathArr = []) {
  const joined = Array.isArray(pathArr) ? pathArr.join("/") : "";

  if (joined.startsWith("kafe/kafe-na-zarna")) return "coffee-beans";
  if (joined.startsWith("kafe/mlyano-kafe")) return "ground-coffee";
  if (joined.startsWith("kafe/kapsuli")) return "capsules";
  if (joined.startsWith("kafe/dozi-i-pods")) return "pods";

  if (joined.startsWith("kafemashini")) return "machines";

  if (joined.startsWith("aksesoari/melachki")) return "grinders";
  if (joined.startsWith("aksesoari/chashi-i-termosi")) return "cups";
  if (joined.startsWith("aksesoari/barista-aksesoari")) return "accessories";

  if (joined.startsWith("siropi-i-dobavki/siropi")) return "syrups";
  if (joined.startsWith("siropi-i-dobavki/podsladiteli")) return "syrups";

  if (joined.startsWith("ofis-i-horeca")) return "office-coffee";

  return "other";
}

async function findCategoryIdByPath(pathArr) {
  const found = await Category.findOne({ path: pathArr, isActive: true })
    .select("_id")
    .lean();

  return found?._id || null;
}

/**
 * Main function used by bot
 * Returns:
 * {
 *   categoryId,
 *   categoryPath,
 *   legacyCategory
 * }
 */
async function categorizeProduct({ title, categoryText, description, brand }) {
  const text = norm(
    [title, categoryText, description, brand].filter(Boolean).join(" ")
  );

  let best = { score: 0, rule: null };

  for (const rule of RULES) {
    const hits = countHits(text, rule.keywords);
    if (!hits) continue;

    const score = hits + (rule.weight || 0);

    if (score > best.score) {
      best = { score, rule };
    }
  }

  if (!best.rule) {
    return {
      categoryId: null,
      categoryPath: [],
      legacyCategory: "other",
    };
  }

  const categoryPath = best.rule.path;
  const categoryId = await findCategoryIdByPath(categoryPath);

  return {
    categoryId,
    categoryPath,
    legacyCategory: legacyFromPath(categoryPath),
  };
}

module.exports = { categorizeProduct };