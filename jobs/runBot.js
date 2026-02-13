require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");

// Ключови думи (Дом и градина)
const KEYWORDS = [
  "solar garden lights",
  "garden hose expandable",
  "drip irrigation kit",
  "kitchen organizer",
  "under sink storage",
  "foldable storage box",
  "wall mounted shelf",
  "tool organizer wall",
];

// 🔗 affiliate tag (можеш да го смениш по-късно)
const AFF_TAG = process.env.AFF_TAG || "homegarden";

/**
 * ✅ Правим affiliateUrl (MVP):
 * - добавяме ?ref=TAG или &ref=TAG
 * - IMPORTANT: за MVP НЕ слагаме affiliateUrl на example.com (за да не пълним боклук)
 */
function buildAffiliateUrl(sourceUrl) {
  const u = String(sourceUrl || "").trim();
  if (!u) return "";

  // 🚫 MVP guard: ако е example.com, не правим affiliate
  if (u.includes("example.com")) return "";

  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}ref=${encodeURIComponent(AFF_TAG)}`;
}

// MVP генератор (по-късно сменяме с реални източници)
function generateProducts(keyword) {
  const slug = keyword.replace(/\s+/g, "-").toLowerCase();

  return [1, 2, 3].map((i) => {
    const sourceUrl = `https://example.com/${slug}/${i}`;

    return {
      title: `${keyword} ${i}`,
      category: guessCategory(keyword),
      source: "other",
      sourceUrl,
      affiliateUrl: buildAffiliateUrl(sourceUrl),
      imageUrl: "",
      price: 10 + i * 5,
      currency: "EUR",
      shippingPrice: 0,
      shippingToBG: true,
      shippingDays: 7,
      notes: "",
    };
  });
}

function guessCategory(keyword) {
  const k = String(keyword || "").toLowerCase();

  if (k.includes("garden") || k.includes("hose") || k.includes("irrigation") || k.includes("solar"))
    return "garden";
  if (k.includes("kitchen")) return "kitchen";
  if (k.includes("tool")) return "tools";
  if (k.includes("storage") || k.includes("shelf") || k.includes("organizer"))
    return "home";

  return "other";
}

/**
 * Scoring rules (MVP):
 * +3 ако има доставка до BG
 * +2 ако price <= 30
 * +1 ако price <= 50
 * +2 ако category != other
 * +1 ако shippingDays <= 10
 */
function computeScore(p) {
  let s = 0;

  if (p.shippingToBG) s += 3;

  if (Number.isFinite(p.price)) {
    if (p.price <= 30) s += 2;
    else if (p.price <= 50) s += 1;
  }

  if (p.category && p.category !== "other") s += 2;

  if (p.shippingDays != null && Number.isFinite(p.shippingDays) && p.shippingDays <= 10) s += 1;

  return s;
}

/**
 * Profit score (MVP):
 * base = score
 * +2 ако има affiliateUrl
 * +1 ако price <= 30
 * +1 ако shippingDays <= 10
 * -1 ако shippingToBG === false
 */
function computeProfitScore(p) {
  let ps = 0;

  ps += Number(p.score || 0);

  if (p.affiliateUrl && String(p.affiliateUrl).trim()) ps += 2;

  if (Number.isFinite(p.price) && p.price <= 30) ps += 1;

  if (p.shippingDays != null && Number.isFinite(p.shippingDays) && p.shippingDays <= 10) ps += 1;

  if (p.shippingToBG === false) ps -= 1;

  return ps;
}

/**
 * Auto-approve rules (MVP):
 * - shippingToBG === true
 * - price <= 50
 * - category != other
 * - score >= 6
 */
function shouldAutoApprove(p) {
  return (
    p.shippingToBG === true &&
    Number.isFinite(p.price) &&
    p.price <= 50 &&
    p.category !== "other" &&
    Number(p.score || 0) >= 6
  );
}

function normalizeProduct(product) {
  const normalized = {
    ...product,
    title: String(product.title || "").trim(),
    sourceUrl: String(product.sourceUrl || "").trim(),
    price: Number(product.price),
    shippingPrice: Number(product.shippingPrice || 0),
    shippingDays: product.shippingDays == null ? null : Number(product.shippingDays),
  };

  // ако price стане NaN -> null (да не чупи скоринга/валидации)
  if (!Number.isFinite(normalized.price)) normalized.price = null;

  // ако shippingDays стане NaN -> null
  if (normalized.shippingDays != null && !Number.isFinite(normalized.shippingDays)) normalized.shippingDays = null;

  // гаранция за category/source, ако някой подаде боклук
  normalized.category = normalized.category || "other";
  normalized.source = normalized.source || "other";

  return normalized;
}

async function addIfNotExists(product) {
  try {
    const normalized = normalizeProduct(product);

    const score = computeScore(normalized);

    const affiliateUrl =
      (normalized.affiliateUrl && String(normalized.affiliateUrl).trim()) ||
      buildAffiliateUrl(normalized.sourceUrl);

    const enriched = {
      ...normalized,
      score,
      affiliateUrl,
      status: "new",
    };

    enriched.profitScore = computeProfitScore(enriched);

    if (shouldAutoApprove(enriched)) {
      enriched.status = "approved";
    }

    const created = await Product.create(enriched);
    return { action: "created", status: created.status };
  } catch (err) {
    if (err && err.code === 11000) return { action: "duplicate" };
    return { action: "error", error: err.message };
  }
}

async function runBot() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI липсва");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Bot connected to MongoDB");

  let created = 0;
  let approved = 0;
  let asNew = 0;
  let duplicates = 0;
  let errors = 0;

  for (const keyword of KEYWORDS) {
    const products = generateProducts(keyword);

    for (const p of products) {
      const r = await addIfNotExists(p);

      if (r.action === "created") {
        created++;
        if (r.status === "approved") approved++;
        else asNew++;
      } else if (r.action === "duplicate") {
        duplicates++;
      } else {
        errors++;
        console.log("❌ item error:", r.error);
      }
    }
  }

  console.log("✅ Done");
  console.log("Created:", created);
  console.log("Approved:", approved);
  console.log("New:", asNew);
  console.log("Duplicates:", duplicates);
  console.log("Errors:", errors);

  await mongoose.disconnect();
}

runBot().catch((err) => {
  console.error("❌ Bot error:", err.message);
  process.exit(1);
});
