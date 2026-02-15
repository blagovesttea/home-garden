// services/categorizer.js
const Category = require("../models/Category");

function norm(s = "") {
  return String(s || "")
    .toLowerCase()
    .replace(/['"]/g, " ")
    .replace(/[^a-z0-9а-я\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countHits(text, keywords = []) {
  let score = 0;
  for (const kw of keywords) {
    const k = norm(kw);
    if (!k) continue;

    // whole-word-ish match (better precision)
    const re = new RegExp(`(^|\\s)${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`, "i");
    if (re.test(text)) score += 4;

    // substring bonus (helps for compound words)
    if (text.includes(k)) score += 1;
  }
  return score;
}

/**
 * Match rules -> categoryPath
 * IMPORTANT: These paths MUST exist in your seeded categories:
 * Home root: ["home", ...]
 * Garden root: ["garden", ...]
 */
const RULES = [
  // =========================
  // HOME > Kitchen & Dining
  // =========================
  {
    path: ["home", "kitchen", "cookware"],
    keywords: ["тиган", "тенджер", "касерол", "съд за готвене", "cookware", "pan", "pot", "wok"],
    weight: 10,
  },
  {
    path: ["home", "kitchen", "bakeware"],
    keywords: ["форма за печене", "тава", "кекс", "мъфин", "bakeware", "baking tray", "muffin", "cake pan"],
    weight: 8,
  },
  {
    path: ["home", "kitchen", "kitchen-tools"],
    keywords: ["шпатула", "черпак", "ренде", "белачка", "отварачка", "kitchen tool", "grater", "peeler", "ladle"],
    weight: 7,
  },
  {
    path: ["home", "kitchen", "knives"],
    keywords: ["нож", "ножица кухненска", "дъска за рязане", "knife", "cutting board", "chef knife"],
    weight: 9,
  },
  {
    path: ["home", "kitchen", "food-storage"],
    keywords: ["кутия", "буркан", "контейнер", "food storage", "container", "jar", "lunch box"],
    weight: 8,
  },
  {
    path: ["home", "kitchen", "small-appliances"],
    keywords: ["блендер", "миксер", "air fryer", "фритюрник", "тостер", "кана", "kettle", "coffee machine", "кафемашина"],
    weight: 10,
  },
  {
    path: ["home", "kitchen", "tableware"],
    keywords: ["чини", "купа", "чаша", "порцелан", "tableware", "plate", "bowl", "cup"],
    weight: 6,
  },
  {
    path: ["home", "kitchen", "drinkware"],
    keywords: ["бутил", "термос", "шише", "канa", "drinkware", "bottle", "thermos", "tumbler"],
    weight: 6,
  },

  // =========================
  // HOME > Cleaning
  // =========================
  {
    path: ["home", "cleaning", "mops"],
    keywords: ["моп", "метла", "висулка", "broom", "mop"],
    weight: 7,
  },
  {
    path: ["home", "cleaning", "cleaning-tools"],
    keywords: ["четка", "squeegee", "парцал", "почистващ инструмент", "cleaning tool"],
    weight: 6,
  },
  {
    path: ["home", "cleaning", "sponges"],
    keywords: ["гъба", "микрофибър", "кърпа", "sponge", "microfiber", "cloth"],
    weight: 6,
  },
  {
    path: ["home", "cleaning", "buckets"],
    keywords: ["кофа", "леген", "bucket", "tub"],
    weight: 6,
  },

  // =========================
  // HOME > Storage
  // =========================
  {
    path: ["home", "storage", "boxes"],
    keywords: ["органайзер", "кутия", "за съхран", "storage box", "organizer", "container"],
    weight: 9,
  },
  {
    path: ["home", "storage", "drawer-organizers"],
    keywords: ["органайзер за чекмедже", "drawer organizer", "divider"],
    weight: 8,
  },
  {
    path: ["home", "storage", "wardrobe"],
    keywords: ["гардероб", "за дрехи", "калъф", "wardrobe organizer", "closet"],
    weight: 7,
  },
  {
    path: ["home", "storage", "shelving"],
    keywords: ["рафт", "етажерка", "стелаж", "shelf", "rack", "shelving"],
    weight: 9,
  },
  {
    path: ["home", "storage", "hangers"],
    keywords: ["закачалк", "hanger"],
    weight: 7,
  },

  // =========================
  // HOME > Decor / Lighting / Bathroom / Bedroom / Improvement
  // =========================
  {
    path: ["home", "decor", "wall-decor"],
    keywords: ["картина", "постер", "рамка", "wall decor", "poster", "frame"],
    weight: 7,
  },
  {
    path: ["home", "decor", "mirrors"],
    keywords: ["огледало", "mirror"],
    weight: 8,
  },
  {
    path: ["home", "decor", "candles"],
    keywords: ["свещ", "candle"],
    weight: 6,
  },
  {
    path: ["home", "decor", "clocks"],
    keywords: ["часовник", "clock"],
    weight: 6,
  },
  {
    path: ["home", "lighting", "led"],
    keywords: ["led", "лента", "led strip", "светлинна лента"],
    weight: 8,
  },
  {
    path: ["home", "bathroom", "bathroom-storage"],
    keywords: ["баня", "душ", "шампоан", "bathroom", "shower", "soap dispenser"],
    weight: 7,
  },
  {
    path: ["home", "bedroom", "bedding"],
    keywords: ["спално", "чаршаф", "плик", "bedding", "bedsheet", "duvet cover"],
    weight: 8,
  },
  {
    path: ["home", "improvement", "hardware"],
    keywords: ["винт", "дюбел", "панта", "скоба", "hardware", "screw", "anchor", "hinge"],
    weight: 8,
  },

  // =========================
  // GARDEN
  // =========================
  {
    path: ["garden", "plants", "seeds"],
    keywords: ["семена", "seed", "seeds"],
    weight: 10,
  },
  {
    path: ["garden", "plants", "soil"],
    keywords: ["тор", "почва", "пръст", "soil", "fertilizer", "compost"],
    weight: 9,
  },
  {
    path: ["garden", "plants", "pots"],
    keywords: ["саксия", "кашпа", "planter", "pot", "pots"],
    weight: 9,
  },
  {
    path: ["garden", "irrigation", "hoses"],
    keywords: ["маркуч", "hose", "hoses"],
    weight: 10,
  },
  {
    path: ["garden", "irrigation", "sprinklers"],
    keywords: ["разпръсквач", "sprinkler"],
    weight: 10,
  },
  {
    path: ["garden", "irrigation", "drip"],
    keywords: ["капково", "drip irrigation", "drip"],
    weight: 10,
  },
  {
    path: ["garden", "tools", "hand-tools"],
    keywords: ["лопат", "гребл", "ножиц", "градински инструмент", "trowel", "rake", "pruner"],
    weight: 9,
  },
  {
    path: ["garden", "tools", "power-tools"],
    keywords: ["косач", "тример", "резач", "chainsaw", "trimmer", "mower"],
    weight: 10,
  },
  {
    path: ["garden", "bbq", "grills"],
    keywords: ["скара", "грил", "барбекю", "grill", "bbq"],
    weight: 10,
  },
  {
    path: ["garden", "garden-decor", "solar"],
    keywords: ["солар", "solar light", "solar"],
    weight: 9,
  },
];

// For quick fallback to legacy category if rules miss
function legacyFromRoot(root) {
  if (root === "home") return "home";
  if (root === "garden") return "garden";
  return "other";
}

async function findCategoryIdByPath(pathArr) {
  // We store "path" array in Category, so we can query directly.
  const found = await Category.findOne({ path: pathArr, isActive: true }).select("_id").lean();
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
  const text = norm([title, categoryText, description, brand].filter(Boolean).join(" "));

  let best = { score: 0, rule: null };

  for (const rule of RULES) {
    const hits = countHits(text, rule.keywords);
    if (!hits) continue;

    // weight helps differentiate strong categories
    const score = hits + (rule.weight || 0);

    if (score > best.score) best = { score, rule };
  }

  if (!best.rule) {
    // No match -> keep minimal
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
    legacyCategory: legacyFromRoot(categoryPath[0]),
  };
}

module.exports = { categorizeProduct };
