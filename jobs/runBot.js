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

// 🔗 affiliate tag (MVP — НЕ е истински AliExpress affiliate link)
const AFF_TAG = process.env.AFF_TAG || "homegarden";

// ✅ 10-мин тест контрол
const MAX_MINUTES = Number(process.env.BOT_MAX_MINUTES || 10); // default 10
const PER_KEYWORD = Number(process.env.BOT_PER_KEYWORD || 6);  // default 6 results/keyword
const REQUEST_DELAY_MS = Number(process.env.BOT_DELAY_MS || 1200); // 1.2s

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * MVP affiliateUrl builder:
 * добавя ?ref=TAG или &ref=TAG (не е истински affiliate на AliExpress)
 */
function buildAffiliateUrl(sourceUrl) {
  const u = String(sourceUrl || "").trim();
  if (!u) return "";
  if (/[?&]ref=/.test(u)) return u;
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}ref=${encodeURIComponent(AFF_TAG)}`;
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
 * Scoring rules (MVP)
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
 * Auto-approve (оставяме FALSE за тест, за да одобряваш ти)
 */
function shouldAutoApprove(_p) {
  return false;
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

  if (!Number.isFinite(normalized.price)) normalized.price = null;
  if (normalized.shippingDays != null && !Number.isFinite(normalized.shippingDays)) normalized.shippingDays = null;

  normalized.category = normalized.category || "other";
  normalized.source = normalized.source || "other";

  return normalized;
}

/**
 * Deep find: намира първия масив от objects, които приличат на AliExpress items
 * (за да не сме зависими от точното runParams дърво)
 */
function deepFindItems(obj, maxDepth = 9) {
  const seen = new Set();

  function walk(node, depth) {
    if (!node || depth > maxDepth) return null;
    if (typeof node !== "object") return null;
    if (seen.has(node)) return null;
    seen.add(node);

    if (Array.isArray(node)) {
      // items масив? търсим productId + title/displayTitle + image/imgUrl
      const ok = node.length > 0 && node.every((x) => x && typeof x === "object");
      if (ok) {
        const sample = node.find(Boolean);
        const hasProductId = sample && (sample.productId || sample.product_id || sample.itemId);
        const hasTitle =
          sample &&
          (sample.title?.displayTitle ||
            sample.title?.display ||
            sample.title ||
            sample.productTitle ||
            sample.displayTitle);

        if (hasProductId && hasTitle) return node;
      }

      for (const v of node) {
        const r = walk(v, depth + 1);
        if (r) return r;
      }
      return null;
    }

    // object
    for (const k of Object.keys(node)) {
      const r = walk(node[k], depth + 1);
      if (r) return r;
    }
    return null;
  }

  return walk(obj, 0);
}

function toHttpsImg(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (s.startsWith("//")) return "https:" + s;
  return s;
}

function pickPrice(item) {
  const prices = item?.prices || item?.price || {};
  const sale = prices?.salePrice || prices?.sale_price || {};
  const orig = prices?.originalPrice || prices?.original_price || {};
  const v =
    sale?.minPrice ??
    sale?.min_price ??
    sale?.min ??
    orig?.minPrice ??
    orig?.min_price ??
    orig?.min ??
    item?.price ??
    item?.salePrice ??
    item?.minPrice;

  const num = Number(v);
  return Number.isFinite(num) ? num : null;
}

function pickCurrency(item) {
  const prices = item?.prices || item?.price || {};
  const sale = prices?.salePrice || {};
  const orig = prices?.originalPrice || {};
  return sale?.currencyCode || orig?.currencyCode || item?.currency || "USD";
}

/**
 * ✅ AliExpress search (scrape): взима HTML и вади window.runParams JSON
 */
async function fetchAliExpressProducts(keyword, limit = 6) {
  const q = String(keyword || "").trim();
  if (!q) return [];

  // URL (варира, но това е стабилен старт)
  const url = `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(q)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  const html = await res.text();

  if (!res.ok) {
    throw new Error(`AliExpress HTTP ${res.status}`);
  }

  // window.runParams = {...};
  const m = html.match(/window\.runParams\s*=\s*(\{[\s\S]*?\});/);
  if (!m) {
    // понякога е minified / различно — логваме частично
    throw new Error("AliExpress: runParams not found (blocked/changed layout)");
  }

  let runParams = null;
  try {
    runParams = JSON.parse(m[1]);
  } catch {
    throw new Error("AliExpress: runParams JSON parse failed");
  }

  const itemsRaw = deepFindItems(runParams) || [];
  const items = Array.isArray(itemsRaw) ? itemsRaw.slice(0, Math.max(1, limit)) : [];

  // map към нашия Product model
  return items
    .map((it) => {
      const productId = it.productId || it.product_id || it.itemId || it.item_id;
      const title =
        it?.title?.displayTitle ||
        it?.title?.display ||
        it?.title ||
        it?.displayTitle ||
        it?.productTitle ||
        "";

      const img = toHttpsImg(it?.image?.imgUrl || it?.imageUrl || it?.imgUrl || "");
      const price = pickPrice(it);
      const currency = pickCurrency(it);

      // canonical sourceUrl
      const sourceUrl = productId
        ? `https://www.aliexpress.com/item/${String(productId).trim()}.html`
        : "";

      return {
        title: String(title || "").trim(),
        category: guessCategory(q),
        source: "aliexpress",
        sourceUrl,
        affiliateUrl: buildAffiliateUrl(sourceUrl),
        imageUrl: img,
        price: price ?? 0, // schema required — за safety
        currency,
        shippingPrice: 0,
        shippingToBG: true, // за тест
        shippingDays: 7,    // за тест
        notes: `AE keyword: ${q}`,
        bg: { foundInBG: "unknown" },
      };
    })
    .filter((p) => p.title && p.sourceUrl);
}

async function addIfNotExists(product) {
  try {
    const normalized = normalizeProduct(product);

    // ако по някаква причина price е null, прескачаме (schema price е required)
    if (normalized.price == null) return { action: "skip", reason: "no price" };

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

    if (shouldAutoApprove(enriched)) enriched.status = "approved";

    const created = await Product.create(enriched);
    return { action: "created", status: created.status };
  } catch (err) {
    if (err && err.code === 11000) return { action: "duplicate" };
    return { action: "error", error: err.message };
  }
}

async function runBot() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI липсва");

  const startedAt = Date.now();
  const deadline = startedAt + MAX_MINUTES * 60 * 1000;

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Bot connected to MongoDB");

  let created = 0;
  let approved = 0;
  let asNew = 0;
  let duplicates = 0;
  let errors = 0;
  let skipped = 0;

  try {
    for (const keyword of KEYWORDS) {
      if (Date.now() > deadline) break;

      console.log(`🔎 AliExpress search: "${keyword}"`);
      let products = [];
      try {
        products = await fetchAliExpressProducts(keyword, PER_KEYWORD);
      } catch (e) {
        errors++;
        console.log("❌ search error:", e.message);
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      for (const p of products) {
        if (Date.now() > deadline) break;

        const r = await addIfNotExists(p);

        if (r.action === "created") {
          created++;
          if (r.status === "approved") approved++;
          else asNew++;
        } else if (r.action === "duplicate") {
          duplicates++;
        } else if (r.action === "skip") {
          skipped++;
        } else {
          errors++;
          console.log("❌ item error:", r.error);
        }

        await sleep(REQUEST_DELAY_MS);
      }
    }

    console.log("✅ Done");
    console.log("Created:", created);
    console.log("Approved:", approved);
    console.log("New:", asNew);
    console.log("Duplicates:", duplicates);
    console.log("Skipped:", skipped);
    console.log("Errors:", errors);
  } finally {
    await mongoose.disconnect();
  }
}

runBot().catch((err) => {
  console.error("❌ Bot error:", err.message);
  process.exit(1);
});
