// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

const authRoutes = require("./routes/auth");
const adminProductsRoutes = require("./routes/admin.products");
const productsRoutes = require("./routes/products");
const ordersRoutes = require("./routes/orders");

// ✅ Categories routes (safe require + show real error)
let categoriesRoutes = null;
let categoriesLoadError = null;

try {
  categoriesRoutes = require("./routes/categories");
  console.log("✅ Routes for categories loaded");
} catch (e) {
  categoriesLoadError = e;
  console.error("❌ Categories routes failed to load:");
  console.error(e && (e.stack || e.message || e));
}

const app = express();

/* =========================
   App settings
========================= */
app.set("trust proxy", 1);

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
  const buildPath = path.join(__dirname, "client", "build");
  app.use(express.static(buildPath));

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