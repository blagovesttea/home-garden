require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");

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

const MAX_MINUTES = Number(process.env.BOT_MAX_MINUTES || 10);
const PER_KEYWORD = Number(process.env.BOT_PER_KEYWORD || 8);
const REQUEST_DELAY_MS = Number(process.env.BOT_DELAY_MS || 800);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

function toSafeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

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
  if (Number.isFinite(p.price) && p.price <= 30) ps += 1;
  if (p.shippingDays != null && Number.isFinite(p.shippingDays) && p.shippingDays <= 10) ps += 1;
  if (p.shippingToBG === false) ps -= 1;
  return ps;
}

function normalizeProduct(product) {
  const normalized = {
    ...product,
    title: String(product.title || "").trim(),
    sourceUrl: String(product.sourceUrl || "").trim(),
    imageUrl: String(product.imageUrl || "").trim(),
    currency: String(product.currency || "EUR").trim(),
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

// --- eBay RSS fetch (NO API KEY) ---
function decodeHtml(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// опит да извадим цена от заглавие (често има “... - $12.34”)
function extractPriceFromTitle(title) {
  const t = String(title || "");
  const m = t.match(/[\$€£]\s?(\d+(?:[.,]\d{1,2})?)/);
  if (!m) return null;
  const v = Number(m[1].replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

function extractCurrency(title) {
  const t = String(title || "");
  if (t.includes("$")) return "USD";
  if (t.includes("€")) return "EUR";
  if (t.includes("£")) return "GBP";
  return "EUR";
}

function stripTracking(url) {
  try {
    const u = new URL(url);
    // махаме типични tracking параметри
    ["_trkparms", "_trksid", "hash", "var", "campid", "mkcid", "mkevt", "mkrid", "siteid"].forEach((k) =>
      u.searchParams.delete(k)
    );
    return u.toString();
  } catch {
    return url;
  }
}

async function fetchEbayRssProducts(keyword, limit = 8) {
  const q = String(keyword || "").trim();
  if (!q) return [];

  // eBay RSS за търсене
  const rssUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&_sacat=0&_rss=1`;

  const res = await fetch(rssUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  const xml = await res.text();
  if (!res.ok) throw new Error(`eBay HTTP ${res.status}`);

  // много прост RSS parse (за тест)
  const items = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

  for (const block of itemBlocks) {
    const titleMatch = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/i);
    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);

    // thumbnail е в media:thumbnail или в description като img
    const thumbMatch =
      block.match(/<media:thumbnail[^>]*url="([^"]+)"/i) ||
      block.match(/<img[^>]*src="([^"]+)"/i);

    const rawTitle = titleMatch ? (titleMatch[1] || titleMatch[2] || "") : "";
    const title = decodeHtml(rawTitle).trim();

    const link = linkMatch ? decodeHtml(linkMatch[1]).trim() : "";
    const imageUrl = thumbMatch ? decodeHtml(thumbMatch[1]).trim() : "";

    if (!title || !link) continue;

    const price = extractPriceFromTitle(title) ?? 25; // fallback за schema required
    const currency = extractCurrency(title);

    items.push({
      title,
      category: guessCategory(q),
      source: "ebay",
      sourceUrl: stripTracking(link),
      affiliateUrl: "", // за тест — после ще го направим affiliate
      imageUrl,
      price,
      currency,
      shippingPrice: 0,
      shippingToBG: true, // за тест
      shippingDays: 7, // за тест
      notes: `eBay RSS keyword: ${q}`,
      bg: { foundInBG: "unknown" },
    });

    if (items.length >= limit) break;
  }

  return items;
}

async function addIfNotExists(product) {
  try {
    const normalized = normalizeProduct(product);

    if (!normalized.title || !normalized.sourceUrl) return { action: "skip", reason: "missing fields" };
    if (normalized.price == null) return { action: "skip", reason: "no price" };

    const score = computeScore(normalized);
    const enriched = {
      ...normalized,
      score,
      status: "new",
    };

    enriched.profitScore = computeProfitScore(enriched);

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
  let duplicates = 0;
  let errors = 0;
  let skipped = 0;

  try {
    for (const keyword of KEYWORDS) {
      if (Date.now() > deadline) break;

      console.log(`🔎 eBay RSS search: "${keyword}"`);

      let products = [];
      try {
        products = await fetchEbayRssProducts(keyword, PER_KEYWORD);
      } catch (e) {
        errors++;
        console.log("❌ search error:", e.message);
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      for (const p of products) {
        if (Date.now() > deadline) break;

        const r = await addIfNotExists(p);
        if (r.action === "created") created++;
        else if (r.action === "duplicate") duplicates++;
        else if (r.action === "skip") skipped++;
        else {
          errors++;
          console.log("❌ item error:", r.error);
        }

        await sleep(REQUEST_DELAY_MS);
      }
    }

    console.log("✅ Done");
    console.log("Created:", created);
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
