// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

const authRoutes = require("./routes/auth");
const adminProductsRoutes = require("./routes/admin.products");
const productsRoutes = require("./routes/products");

// ✅ Categories routes (safe require)
let categoriesRoutes = null;
try {
  categoriesRoutes = require("./routes/categories");
  console.log("✅ Categories routes loaded");
} catch (e) {
  console.log("ℹ️ routes/categories.js not found (categories API disabled).");
}

// ✅ Profitshare bot (your file is in /jobs/runBot.js)
let runProfitshareBot = null;
try {
  runProfitshareBot = require("./jobs/runBot");
} catch (e) {
  console.log("ℹ️ jobs/runBot.js not found (bot disabled).");
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
   Health
========================= */
app.get("/health", (req, res) => res.json({ ok: true }));

/* =========================
   API Routes (MUST be before React catch-all)
========================= */
app.use("/auth", authRoutes);
app.use("/admin", adminProductsRoutes);
app.use("/products", productsRoutes);

if (categoriesRoutes) {
  app.use("/categories", categoriesRoutes);
}

/* =========================
   Serve React build (production)
========================= */
if (process.env.NODE_ENV === "production") {
  const buildPath = path.join(__dirname, "client", "build");
  app.use(express.static(buildPath));

  // ✅ keep catch-all LAST
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => res.send("API running (dev) ✅"));
}

/* =========================
   Bot runner (safe, non-blocking)
========================= */
function startBotOnceAfterBoot() {
  if (!runProfitshareBot) return;

  const feedUrl = process.env.PROFITSHARE_FEED_URL;
  if (!feedUrl) {
    console.log("ℹ️ PROFITSHARE_FEED_URL missing (bot disabled).");
    return;
  }

  setTimeout(async () => {
    try {
      console.log("🤖 Profitshare bot starting...");
      await runProfitshareBot();
      console.log("✅ Profitshare bot finished.");
    } catch (err) {
      console.error("❌ Profitshare bot error:", err?.message || err);
    }
  }, 15_000);
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
      startBotOnceAfterBoot();
    });
  } catch (err) {
    console.error("❌ Boot error:", err);
    process.exit(1);
  }
}

start();
