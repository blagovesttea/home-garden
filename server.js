require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

const authRoutes = require("./routes/auth");
const adminProductsRoutes = require("./routes/admin.products");
const productsRoutes = require("./routes/products");

const app = express();

/* =========================
   Middlewares
========================= */
app.use(express.json());

// Render-friendly CORS
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

/* =========================
   API Routes
========================= */
app.use("/auth", authRoutes);
app.use("/admin", adminProductsRoutes);
app.use("/products", productsRoutes);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* =========================
   Serve React (production)
========================= */
if (process.env.NODE_ENV === "production") {
  const buildPath = path.join(__dirname, "client", "build");

  // Static files
  app.use(express.static(buildPath));

  // Express 5 compatible wildcard (FIX for your error)
  app.get("/*", (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
} else {
  // Dev test
  app.get("/", (req, res) => {
    res.send("API running (dev) ✅");
  });
}

/* =========================
   Start Server
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
    console.error("❌ Boot error:", err.message);
    process.exit(1);
  }
}

start();
