// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const compression = require("compression");
const helmet = require("helmet");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");

let sharp = null;
try {
  sharp = require("sharp");
  console.log("✅ sharp loaded");
} catch (e) {
  console.warn("⚠️ sharp is not installed. Image uploads will continue without local compression.");
}

const Product = require("./models/Product");

const authRoutes = require("./routes/auth");
const adminProductsRoutes = require("./routes/admin.products");
const productsRoutes = require("./routes/products");
const ordersRoutes = require("./routes/orders");

const auth = require("./middleware/auth");
const adminOnly = require("./middleware/admin");

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
   Cloudinary
========================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB
  },
});

function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });

    stream.end(buffer);
  });
}

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

async function dropLegacyProductIndexes() {
  try {
    const productsCollection = mongoose.connection.collection("products");
    const indexes = await productsCollection.indexes();
    const hasLegacySourceUrlIndex = indexes.some(
      (idx) => idx && idx.name === "sourceUrl_1"
    );

    if (!hasLegacySourceUrlIndex) {
      console.log("ℹ️ Legacy index sourceUrl_1 not found");
      return;
    }

    await productsCollection.dropIndex("sourceUrl_1");
    console.log("✅ Dropped legacy unique index: sourceUrl_1");
  } catch (err) {
    const msg = err?.message || String(err || "");

    if (
      err?.codeName === "IndexNotFound" ||
      /index not found/i.test(msg) ||
      /ns not found/i.test(msg)
    ) {
      console.log("ℹ️ Legacy index sourceUrl_1 already missing");
      return;
    }

    console.error("⚠️ Failed to drop legacy index sourceUrl_1:");
    console.error(err?.stack || err?.message || err);
  }
}

function safeBaseName(filename = "") {
  const originalName = String(filename || "image");
  return (
    originalName
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || `product-${Date.now()}`
  );
}

async function optimizeImageBuffer(buffer, mime = "") {
  if (!sharp || !buffer) {
    return {
      buffer,
      format: null,
      optimized: false,
    };
  }

  const type = String(mime || "").toLowerCase();

  try {
    let pipeline = sharp(buffer, { failOnError: false }).rotate().resize({
      width: 1800,
      height: 1800,
      fit: "inside",
      withoutEnlargement: true,
    });

    // За PNG/WebP/GIF uploads предпочитаме webp, за снимки jpeg.
    if (type.includes("png") || type.includes("webp") || type.includes("gif")) {
      pipeline = pipeline.webp({
        quality: 82,
        effort: 4,
      });

      return {
        buffer: await pipeline.toBuffer(),
        format: "webp",
        optimized: true,
      };
    }

    pipeline = pipeline.jpeg({
      quality: 82,
      mozjpeg: true,
      chromaSubsampling: "4:4:4",
    });

    return {
      buffer: await pipeline.toBuffer(),
      format: "jpg",
      optimized: true,
    };
  } catch (err) {
    console.warn("⚠️ sharp optimize failed, using original buffer:");
    console.warn(err?.stack || err?.message || err);

    return {
      buffer,
      format: null,
      optimized: false,
    };
  }
}

function buildOptimizedCloudinaryUrl(publicId) {
  if (!publicId) return "";

  try {
    return cloudinary.url(publicId, {
      secure: true,
      fetch_format: "auto",
      quality: "auto",
      width: 1600,
      height: 1600,
      crop: "limit",
    });
  } catch (_) {
    return "";
  }
}

function extractCloudinaryPublicId(value = "") {
  const input = String(value || "").trim();
  if (!input) return "";

  // ако е public id директно
  if (!/^https?:\/\//i.test(input) && !input.includes("/upload/")) {
    return input.replace(/\.[a-z0-9]+$/i, "");
  }

  try {
    const url = new URL(input);
    const pathname = url.pathname || "";
    const uploadMarker = "/upload/";
    const uploadIndex = pathname.indexOf(uploadMarker);

    if (uploadIndex === -1) return "";

    let rest = pathname.slice(uploadIndex + uploadMarker.length);

    // махаме version частта: v123456/
    rest = rest.replace(/^v\d+\//, "");

    // махаме extension-а
    rest = rest.replace(/\.[a-z0-9]+$/i, "");

    return rest;
  } catch (_) {
    return "";
  }
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
   Admin image upload
========================= */
app.post(
  "/admin/upload-image",
  auth,
  adminOnly,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!process.env.CLOUDINARY_CLOUD_NAME) {
        return res.status(500).json({
          ok: false,
          message: "Липсва CLOUDINARY_CLOUD_NAME",
        });
      }

      if (!process.env.CLOUDINARY_API_KEY) {
        return res.status(500).json({
          ok: false,
          message: "Липсва CLOUDINARY_API_KEY",
        });
      }

      if (!process.env.CLOUDINARY_API_SECRET) {
        return res.status(500).json({
          ok: false,
          message: "Липсва CLOUDINARY_API_SECRET",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          ok: false,
          message: "Няма качен файл",
        });
      }

      const mime = String(req.file.mimetype || "").toLowerCase();
      if (!mime.startsWith("image/")) {
        return res.status(400).json({
          ok: false,
          message: "Позволени са само изображения",
        });
      }

      const baseName = safeBaseName(req.file.originalname);
      const optimized = await optimizeImageBuffer(req.file.buffer, mime);

      const result = await uploadBufferToCloudinary(optimized.buffer, {
        folder: "coffee-market/products",
        resource_type: "image",
        public_id: `${Date.now()}-${baseName}`,
        overwrite: false,
      });

      const optimizedUrl =
        buildOptimizedCloudinaryUrl(result.public_id) || result.secure_url;

      return res.json({
        ok: true,
        message: "Снимката е качена успешно",

        // ✅ основни полета
        url: optimizedUrl,
        imageUrl: optimizedUrl,
        src: optimizedUrl,

        // ✅ оригинален Cloudinary URL
        originalUrl: result.secure_url,
        secure_url: result.secure_url,

        // ✅ public id в различни варианти за съвместимост
        publicId: result.public_id,
        public_id: result.public_id,

        // ✅ полезни метаданни
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        originalName: req.file.originalname,
        optimized: optimized.optimized,
        optimizedUrl,
      });
    } catch (err) {
      console.error("❌ Cloudinary upload error:", err?.stack || err?.message || err);
      return res.status(500).json({
        ok: false,
        message: "Грешка при качване на снимката",
        error: err?.message || "upload failed",
      });
    }
  }
);

/* =========================
   Admin image delete from Cloudinary
========================= */
app.delete("/admin/delete-image", auth, adminOnly, async (req, res) => {
  try {
    const publicId =
      String(req.body?.publicId || req.body?.public_id || "").trim() ||
      extractCloudinaryPublicId(req.body?.url || req.body?.imageUrl || req.body?.src || "");

    if (!publicId) {
      return res.status(400).json({
        ok: false,
        message: "Липсва publicId или валиден Cloudinary URL",
      });
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });

    if (result?.result !== "ok" && result?.result !== "not found") {
      return res.status(400).json({
        ok: false,
        message: "Cloudinary не успя да изтрие снимката",
        cloudinary: result,
      });
    }

    return res.json({
      ok: true,
      message:
        result?.result === "not found"
          ? "Снимката не беше намерена в Cloudinary"
          : "Снимката е изтрита успешно",
      publicId,
      cloudinary: result?.result || "unknown",
    });
  } catch (err) {
    console.error("❌ Cloudinary delete error:", err?.stack || err?.message || err);
    return res.status(500).json({
      ok: false,
      message: "Грешка при триене на снимката",
      error: err?.message || "delete failed",
    });
  }
});

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

    await dropLegacyProductIndexes();

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