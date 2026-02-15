// jobs/runBot.js
require("dotenv").config();

const Product = require("../models/Product");

/* =========================
   Profitshare Feed Bot (CSV)
   - Uses PROFITSHARE_FEED_URL (Render Env Var)
   - Upsert by sourceUrl (no duplicates)
   - Does NOT connect/disconnect Mongo (server.js already connects)
   - Exports a function (so server.js can call it)
   - IMPORTANT: does NOT downgrade approved products back to new
========================= */

const FEED_URL = process.env.PROFITSHARE_FEED_URL;
const MAX_ROWS = Number(process.env.BOT_MAX_ROWS || 2000);
const REQUEST_TIMEOUT_MS = Number(process.env.BOT_TIMEOUT_MS || 60000);

function toNumber(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;
  const normalized = s.replace(/\s+/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function normStr(s) {
  return (s == null ? "" : String(s)).trim();
}

function guessCategoryFromText(text) {
  const t = normStr(text).toLowerCase();

  if (
    t.includes("градин") ||
    t.includes("garden") ||
    t.includes("полив") ||
    t.includes("маркуч") ||
    t.includes("солар") ||
    t.includes("външ")
  )
    return "garden";

  if (t.includes("кухн") || t.includes("kitchen")) return "kitchen";
  if (t.includes("инструмент") || t.includes("tool")) return "tools";
  if (
    t.includes("органайзер") ||
    t.includes("storage") ||
    t.includes("рафт") ||
    t.includes("shelf") ||
    t.includes("дом") ||
    t.includes("home") ||
    t.includes("декор") ||
    t.includes("decor") ||
    t.includes("мебел")
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
  if (p.freeShipping) s += 1;
  return s;
}

function computeProfitScore(p) {
  let ps = p.score || 0;
  if (p.salePrice && p.price && p.salePrice < p.price) ps += 1;
  return ps;
}

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

  const header = parseLine(lines[0]).map((h) => h.replace(/^\uFEFF/, ""));
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
    if (!res.ok) throw new Error(`Feed HTTP ${res.status} | head: ${text.slice(0, 120)}`);
    return text;
  } finally {
    clearTimeout(t);
  }
}

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== "") return row[k];
  }
  return "";
}

async function runBot() {
  if (!FEED_URL) {
    console.log("ℹ️ PROFITSHARE_FEED_URL missing (bot skipped).");
    return { ok: false, reason: "missing_feed_url" };
  }

  console.log("🤖 Profitshare bot: fetching feed...");
  const csvText = await fetchFeed(FEED_URL);

  let rows = parseCSV(csvText, ";");
  if (rows.length <= 1) rows = parseCSV(csvText, ",");

  console.log("🤖 Feed rows parsed:", rows.length);

  let upserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const limited = rows.slice(0, MAX_ROWS);

  for (const row of limited) {
    try {
      const advertiser = normStr(pick(row, ["Име рекламодател", "Advertiser", "Merchant"]));
      const categoryText = normStr(pick(row, ["Категория", "Category"]));
      const manufacturer = normStr(pick(row, ["Производител", "Manufacturer", "Brand"]));
      const productCode = normStr(pick(row, ["Код продукт", "Product code", "SKU"]));

      const title = normStr(pick(row, ["Наименование на продукта", "Product name", "Name", "Title"]));
      const description = normStr(pick(row, ["Описание на продукта", "Description"]));

      // ✅ affiliate link
      const affiliateUrl = normStr(
        pick(row, ["Текстов линк на продукта", "Affiliate URL", "Product URL", "URL", "Link"])
      );

      // ✅ if feed provides a clean product link (optional)
      const cleanProductUrl = normStr(
        pick(row, ["Линк към продукта", "Продуктов линк", "Product link", "Product Link"])
      );

      const imageUrl = normStr(pick(row, ["Профилна снимка", "Image", "Image URL", "ImageUrl"]));

      const priceVat = toNumber(pick(row, ["Цена с ДДС", "Price", "Price VAT"]));
      const salePriceVat = toNumber(pick(row, ["Цена с намаление, с ДДС", "Sale price", "Discount price"]));
      const currency = normStr(pick(row, ["Валута", "Currency"])) || "EUR";

      const freeShippingRaw = normStr(pick(row, ["Безплатна доставка", "Free shipping", "FreeShipping"]));
      const giftRaw = normStr(pick(row, ["Включен подарък", "Gift", "Included gift"]));

      const freeShipping =
        freeShippingRaw.toLowerCase() === "да" ||
        freeShippingRaw.toLowerCase() === "yes" ||
        freeShippingRaw === "1";

      const hasGift =
        giftRaw.toLowerCase() === "да" ||
        giftRaw.toLowerCase() === "yes" ||
        giftRaw === "1";

      // ✅ Use cleanProductUrl if exists, else affiliateUrl.
      const sourceUrl = cleanProductUrl || affiliateUrl;

      if (!title || !affiliateUrl || !sourceUrl) {
        skipped++;
        continue;
      }

      const category = guessCategoryFromText(`${categoryText} ${title}`);
      const price = priceVat ?? salePriceVat ?? null;

      // ✅ if product already exists and is approved, keep it approved
      const existing = await Product.findOne({ sourceUrl }).select("status").lean();
      const keepStatus = existing?.status === "approved";

      const doc = {
        title,
        description,
        category,
        source: advertiser || "profitshare",
        brand: manufacturer || undefined,

        imageUrl,
        sourceUrl,
        affiliateUrl,

        price,
        salePrice: salePriceVat || undefined,
        currency,

        freeShipping,
        hasGift,

        score: 0,
        profitScore: 0,

        // ✅ admin approves manually
        status: keepStatus ? "approved" : "new",
      };

      doc.score = computeScore(doc);
      doc.profitScore = computeProfitScore({ ...doc, salePrice: salePriceVat });

      const res = await Product.updateOne(
        { sourceUrl: doc.sourceUrl },
        {
          $set: {
            ...doc,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
            productCode: productCode || undefined,
          },
        },
        { upsert: true }
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

  return { ok: true, upserted, updated, skipped, errors, total: limited.length };
}

module.exports = runBot;
