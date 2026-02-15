// jobs/runBot.js
require("dotenv").config();

const Product = require("../models/Product");

/* =========================
   Profitshare Feed Bot (CSV) — schema-safe
   - Uses PROFITSHARE_FEED_URL (Render Env Var)
   - Upsert by sourceUrl (unique)
   - Does NOT connect/disconnect Mongo (server.js already connects)
   - Exports a function
   - Does NOT downgrade approved -> new
   - Works with Profitshare EN columns (and BG too)
   - Keeps your Product schema happy (required fields + source enum)
========================= */

const FEED_URL = process.env.PROFITSHARE_FEED_URL;
const MAX_ROWS = Number(process.env.BOT_MAX_ROWS || 2000);
const REQUEST_TIMEOUT_MS = Number(process.env.BOT_TIMEOUT_MS || 60000);

function normStr(s) {
  return (s == null ? "" : String(s)).trim();
}

function toNumber(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;

  // "1 234,56" or "1234.56"
  const normalized = s.replace(/\s+/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function guessCategoryFromText(text) {
  const t = normStr(text).toLowerCase();

  if (
    t.includes("градин") ||
    t.includes("garden") ||
    t.includes("полив") ||
    t.includes("ириг") ||
    t.includes("маркуч") ||
    t.includes("hose") ||
    t.includes("солар") ||
    t.includes("solar") ||
    t.includes("външ") ||
    t.includes("outdoor")
  )
    return "garden";

  if (t.includes("кухн") || t.includes("kitchen")) return "kitchen";
  if (t.includes("инструмент") || t.includes("tool")) return "tools";

  if (
    t.includes("органайзер") ||
    t.includes("organizer") ||
    t.includes("storage") ||
    t.includes("съхран") ||
    t.includes("рафт") ||
    t.includes("shelf") ||
    t.includes("дом") ||
    t.includes("home") ||
    t.includes("декор") ||
    t.includes("decor") ||
    t.includes("мебел") ||
    t.includes("furniture")
  )
    return "home";

  return "other";
}

function computeScore(p) {
  let s = 0;
  if (p.category && p.category !== "other") s += 2;

  if (typeof p.price === "number") {
    if (p.price <= 50) s += 2;
    else if (p.price <= 120) s += 1;
  }

  if (p.imageUrl) s += 1;
  return s;
}

function computeProfitScore(p) {
  let ps = p.score || 0;
  if (p.salePrice && p.price && p.salePrice < p.price) ps += 1;
  return ps;
}

/** Small CSV parser (supports delimiter ; and quotes) */
function parseCSV(text, delimiter = ";") {
  const rows = [];
  const lines = String(text || "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  if (!lines.length) return rows;

  function parseLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && ch === delimiter) {
        out.push(cur);
        cur = "";
        continue;
      }

      cur += ch;
    }

    out.push(cur);
    return out.map((v) => v.trim());
  }

  const header = parseLine(lines[0]).map((h) => h.replace(/^\uFEFF/, "")); // strip BOM
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (!cols.length) continue;

    const obj = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = cols[c] ?? "";
    rows.push(obj);
  }

  return rows;
}

async function fetchFeed(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (AffiliateBot/1.0)",
        Accept: "text/csv,application/csv,text/plain,*/*",
      },
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Feed HTTP ${res.status} | head: ${text.slice(0, 140)}`);
    }
    return text;
  } finally {
    clearTimeout(t);
  }
}

// Pick by known keys (fast path)
function pick(row, keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== "") return row[k];
  }
  return "";
}

// Fallback: find first URL in row values
function findFirstUrlInRow(row) {
  for (const v of Object.values(row || {})) {
    const s = normStr(v);
    if (!s) continue;
    if (/^https?:\/\/\S+/i.test(s)) return s;
  }
  return "";
}

// Fallback: find first image-like url
function findFirstImageUrl(row) {
  for (const v of Object.values(row || {})) {
    const s = normStr(v);
    if (!s) continue;

    if (/^https?:\/\/\S+\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(s)) return s;
    if (/^https?:\/\/\S+/i.test(s) && /image|img|cdn|media|static/i.test(s)) return s;
  }
  return "";
}

// Detect price from known columns + scan
function findPrice(row) {
  // Prefer price with VAT
  const pVat = toNumber(
    pick(row, [
      // EN from your logs:
      "Price with VAT",
      // BG variants:
      "Цена с ДДС",
      // generic:
      "Price VAT",
      "price_vat",
      "Price",
      "Цена",
    ])
  );
  if (pVat != null) return pVat;

  // Discount price with VAT
  const pDiscVat = toNumber(
    pick(row, [
      // EN from your logs:
      "Price with discount, with VAT",
      // BG variants:
      "Цена с намаление, с ДДС",
      // generic:
      "Sale price",
      "Discount price",
      "sale_price",
      "discount_price",
    ])
  );
  if (pDiscVat != null) return pDiscVat;

  // As last resort: scan headers containing "price" / "цена"
  for (const [k, v] of Object.entries(row || {})) {
    const key = String(k).toLowerCase();
    if (key.includes("price") || key.includes("цена")) {
      const n = toNumber(v);
      if (n != null) return n;
    }
  }

  return null;
}

// Detect sale price (optional)
function findSalePrice(row) {
  const pDiscVat = toNumber(
    pick(row, [
      "Price with discount, with VAT",
      "Цена с намаление, с ДДС",
      "Sale price",
      "Discount price",
    ])
  );
  if (pDiscVat != null) return pDiscVat;

  const pDiscNoVat = toNumber(
    pick(row, [
      "Price with discount, without VAT",
      "Цена с намаление без ДДС",
      "Discount price without VAT",
    ])
  );
  if (pDiscNoVat != null) return pDiscNoVat;

  return null;
}

async function runBot() {
  if (!FEED_URL) {
    console.log("ℹ️ PROFITSHARE_FEED_URL missing (bot skipped).");
    return { ok: false, reason: "missing_feed_url" };
  }

  console.log("🤖 Profitshare bot starting...");
  console.log("🤖 Profitshare bot: fetching feed...");

  const csvText = await fetchFeed(FEED_URL);

  // Profitshare often uses ";"
  let rows = parseCSV(csvText, ";");
  if (rows.length <= 1) rows = parseCSV(csvText, ",");

  console.log("🤖 Feed rows parsed:", rows.length);

  if (rows.length > 0) {
    console.log("🧾 Feed columns (first row):", Object.keys(rows[0]));
  }

  let upserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const limited = rows.slice(0, MAX_ROWS);

  for (const row of limited) {
    try {
      // ✅ These match your EN feed columns (from logs) + BG fallbacks
      const advertiser = normStr(
        pick(row, [
          "Advertiser name",
          "Име рекламодател",
          "Advertiser",
          "Merchant",
          "Рекламодател",
        ])
      );

      const categoryText = normStr(pick(row, ["Category", "Категория"]));
      const manufacturer = normStr(pick(row, ["Manufacturer", "Производител", "Brand"]));
      const productCode = normStr(pick(row, ["Product code", "Код продукт", "SKU"]));

      const title = normStr(
        pick(row, [
          "Product name",
          "Наименование на продукта",
          "Name",
          "Title",
          "Product Name",
        ])
      );

      const description = normStr(
        pick(row, [
          "Product description",
          "Описание на продукта",
          "Description",
        ])
      );

      // ✅ affiliate link (from your EN feed column name)
      let affiliateUrl = normStr(
        pick(row, [
          "Product affiliate link",
          "Текстов линк на продукта",
          "Affiliate URL",
          "Affiliate link",
          "Tracking URL",
          "URL",
          "Link",
          "Product URL",
          "Product Link",
        ])
      );
      if (!affiliateUrl) affiliateUrl = findFirstUrlInRow(row);

      // ✅ image (from your EN feed column name)
      let imageUrl = normStr(
        pick(row, [
          "Product picture",
          "Профилна снимка",
          "Image",
          "Image URL",
          "ImageUrl",
        ])
      );
      if (!imageUrl) imageUrl = findFirstImageUrl(row);

      // ✅ required by your schema
      const price = findPrice(row);
      const salePrice = findSalePrice(row);

      const currency = normStr(pick(row, ["Currency", "Валута"])) || "EUR";

      // ✅ sourceUrl must be unique+required; pick best stable key
      // For Profitshare we usually only have affiliate link; that's fine as unique.
      const sourceUrl = affiliateUrl || productCode;

      if (!title || !affiliateUrl || !sourceUrl || typeof price !== "number" || price <= 0) {
        skipped++;
        continue;
      }

      const category = guessCategoryFromText(`${categoryText} ${title}`);

      // ✅ keep approved if it was already approved
      const existing = await Product.findOne({ sourceUrl }).select("status").lean();
      const keepApproved = existing?.status === "approved";

      // ✅ schema-safe product doc (your Product.js requires: title, category, source, sourceUrl, price)
      const doc = {
        title,
        category,

        // Your schema source enum is: ["amazon_de","aliexpress","temu","ebay","other"]
        // Profitshare isn't listed, so we must store "other"
        source: "other",

        sourceUrl,
        affiliateUrl,
        imageUrl,

        price,
        currency,

        // schema fields (safe defaults)
        shippingPrice: 0,
        shippingToBG: true,
        shippingDays: null,

        // analytics fields default in schema, no need to set

        // optional schema fields
        notes: advertiser
          ? `advertiser: ${advertiser}${manufacturer ? ` | brand: ${manufacturer}` : ""}${
              productCode ? ` | code: ${productCode}` : ""
            }`
          : "",

        score: 0,
        profitScore: 0,

        status: keepApproved ? "approved" : "new",
      };

      doc.score = computeScore(doc);
      doc.profitScore = computeProfitScore({ ...doc, salePrice });

      const res = await Product.updateOne(
        { sourceUrl: doc.sourceUrl },
        {
          $set: {
            ...doc,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
            // not in schema now, but OK in Mongo; you can add later if you want
            productCode: productCode || undefined,
          },
        },
        { upsert: true, runValidators: true }
      );

      if (res.upsertedCount) upserted++;
      else if (res.modifiedCount) updated++;
    } catch (e) {
      errors++;
      console.log("❌ Row error:", e?.message || e);
    }
  }

  console.log("✅ Profitshare bot done.");
  console.log("Upserted:", upserted);
  console.log("Updated:", updated);
  console.log("Skipped:", skipped);
  console.log("Errors:", errors);
  console.log("✅ Profitshare bot finished.");

  return { ok: true, upserted, updated, skipped, errors, total: limited.length };
}

module.exports = runBot;
