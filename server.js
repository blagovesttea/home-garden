// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const compression = require("compression");
const helmet = require("helmet");

const Product = require("./models/Product");

const authRoutes = require("./routes/auth");
const adminProductsRoutes = require("./routes/admin.products");
const productsRoutes = require("./routes/products");
const ordersRoutes = require("./routes/orders");

// ✅ Categories routes (safe require + show real error)
let categoriesRoutes = null;
let categoriesLoadError = null;

// ✅ Category model (safe require)
let Category = null;
let categoryModelLoadError = null;

try {
  categoriesRoutes = require("./routes/categories");
  console.log("✅ Routes for categories loaded");
} catch (e) {
  categoriesLoadError = e;
  console.error("❌ Categories routes failed to load:");
  console.error(e && (e.stack || e.message || e));
}

try {
  Category = require("./models/Category");
  console.log("✅ Category model loaded");
} catch (e) {
  categoryModelLoadError = e;
  console.error("⚠️ Category model failed to load:");
  console.error(e && (e.stack || e.message || e));
}

const app = express();

/* =========================
   Helpers
========================= */
function getSiteUrl(req) {
  const envUrl =
    process.env.SITE_URL ||
    process.env.PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "";

  if (envUrl) {
    return String(envUrl).replace(/\/+$/, "");
  }

  if (req) {
    return `${req.protocol}://${req.get("host")}`;
  }

  return "http://localhost:8000";
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildSitemapUrl(loc, lastmod = null, changefreq = null, priority = null) {
  return [
    "<url>",
    `<loc>${escapeXml(loc)}</loc>`,
    lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : "",
    changefreq ? `<changefreq>${escapeXml(changefreq)}</changefreq>` : "",
    priority != null ? `<priority>${priority}</priority>` : "",
    "</url>",
  ]
    .filter(Boolean)
    .join("");
}

function resolveBuildPath() {
  const candidates = [
    process.env.CLIENT_BUILD_PATH
      ? path.resolve(process.env.CLIENT_BUILD_PATH)
      : null,
    path.join(__dirname, "client", "build"),
    path.join(__dirname, "build"),
    path.join(__dirname, "..", "client", "build"),
    path.join(__dirname, "..", "frontend", "build"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }

  return path.join(__dirname, "client", "build");
}

/* =========================
   App settings
========================= */
app.set("trust proxy", 1);

/* =========================
   Security / Perf Middlewares
========================= */
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(compression());

/* =========================
   Canonical host redirect
   Use one of these env vars:
   - PRIMARY_DOMAIN
   - CANONICAL_HOST
   Example: coffeemarket.bg
========================= */
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "production") return next();

  const canonicalHost = (
    process.env.PRIMARY_DOMAIN ||
    process.env.CANONICAL_HOST ||
    ""
  )
    .trim()
    .toLowerCase();

  if (!canonicalHost) return next();

  const host = String(req.get("host") || "").toLowerCase();

  if (!host || host === canonicalHost) return next();

  return res.redirect(301, `${req.protocol}://${canonicalHost}${req.originalUrl}`);
});

/* =========================
   Middlewares
========================= */
app.use(express.json({ limit: "2mb" }));

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options(/.*/, cors({ origin: true, credentials: true }));

/* =========================
   Health / Basic info
========================= */
app.get("/health", (req, res) =>
  res.json({
    ok: true,
    app: "coffee-shop-api",
    message: "Сървърът работи успешно",
  })
);

app.get("/api-info", (req, res) =>
  res.json({
    ok: true,
    name: "Coffee Shop API",
    description: "API за онлайн магазин за кафе продукти",
    env: process.env.NODE_ENV || "development",
  })
);

/* =========================
   SEO: robots.txt
========================= */
app.get("/robots.txt", (req, res) => {
  const siteUrl = getSiteUrl(req);

  res.type("text/plain");
  res.send(
    [
      "User-agent: *",
      "Allow: /",
      "",
      `Sitemap: ${siteUrl}/sitemap.xml`,
    ].join("\n")
  );
});

/* =========================
   SEO: sitemap.xml
========================= */
app.get("/sitemap.xml", async (req, res) => {
  try {
    const siteUrl = getSiteUrl(req);
    const urls = [];

    urls.push(
      buildSitemapUrl(`${siteUrl}/`, new Date().toISOString(), "daily", "1.0")
    );

    urls.push(
      buildSitemapUrl(
        `${siteUrl}/products`,
        new Date().toISOString(),
        "daily",
        "0.9"
      )
    );

    if (Category) {
      try {
        const categories = await Category.find({ isActive: true })
          .select("path updatedAt")
          .lean();

        for (const cat of categories) {
          const pathSegments = Array.isArray(cat?.path)
            ? cat.path.filter(Boolean)
            : [];

          if (!pathSegments.length) continue;

          urls.push(
            buildSitemapUrl(
              `${siteUrl}/?category=${encodeURIComponent(pathSegments.join("/"))}`,
              cat?.updatedAt
                ? new Date(cat.updatedAt).toISOString()
                : new Date().toISOString(),
              "weekly",
              "0.7"
            )
          );
        }
      } catch (e) {
        console.error("⚠️ Failed to include categories in sitemap:");
        console.error(e && (e.stack || e.message || e));
      }
    } else if (categoryModelLoadError) {
      // do nothing, just keep sitemap alive
    }

    const products = await Product.find({
      status: "approved",
      isActive: true,
      slug: { $exists: true, $ne: "" },
    })
      .select("slug updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    for (const product of products) {
      urls.push(
        buildSitemapUrl(
          `${siteUrl}/products/${encodeURIComponent(product.slug)}`,
          product?.updatedAt
            ? new Date(product.updatedAt).toISOString()
            : new Date().toISOString(),
          "weekly",
          "0.8"
        )
      );
    }

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
      urls.join("") +
      `</urlset>`;

    res.header("Content-Type", "application/xml; charset=utf-8");
    return res.send(xml);
  } catch (err) {
    console.error("❌ sitemap.xml error:", err?.stack || err?.message || err);
    return res.status(500).type("text/plain").send("Sitemap generation failed");
  }
});

/* =========================
   API Routes
========================= */
app.use("/auth", authRoutes);
app.use("/admin", adminProductsRoutes);
app.use("/products", productsRoutes);
app.use("/orders", ordersRoutes);

// ✅ Categories
if (categoriesRoutes) {
  app.use("/categories", categoriesRoutes);
} else {
  app.get("/categories", (req, res) =>
    res.status(503).json({
      ok: false,
      message: "Категориите временно не са достъпни",
      error: categoriesLoadError
        ? categoriesLoadError.message || String(categoriesLoadError)
        : "unknown",
    })
  );

  app.get("/categories/flat", (req, res) =>
    res.status(503).json({
      ok: false,
      message: "Категориите временно не са достъпни",
      error: categoriesLoadError
        ? categoriesLoadError.message || String(categoriesLoadError)
        : "unknown",
    })
  );

  app.get("/categories/by-path", (req, res) =>
    res.status(503).json({
      ok: false,
      message: "Категориите временно не са достъпни",
      error: categoriesLoadError
        ? categoriesLoadError.message || String(categoriesLoadError)
        : "unknown",
    })
  );
}

/* =========================
   Serve React build (production)
========================= */
if (process.env.NODE_ENV === "production") {
  const buildPath = resolveBuildPath();
  console.log("📦 Using build path:", buildPath);

  app.use(
    express.static(buildPath, {
      maxAge: "30d",
      etag: true,
      index: false,
    })
  );

  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
} else {
  app.get("/", (req, res) =>
    res.send("Coffee shop API работи успешно (dev) ✅")
  );
}

/* =========================
   Start server
========================= */
async function start() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI липсва (Render Env Vars)");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    const PORT = process.env.PORT || 8000;
    app.listen(PORT, () => {
      console.log("✅ Server running on port " + PORT);
    });
  } catch (err) {
    console.error("❌ Boot error:", err?.stack || err?.message || err);
    process.exit(1);
  }
}

start();