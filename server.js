require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth");
const adminProductsRoutes = require("./routes/admin.products");
const productsRoutes = require("./routes/products");

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

// Routes
app.use("/auth", authRoutes);
app.use("/admin", adminProductsRoutes);
app.use("/", productsRoutes);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Start server
async function start() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI липсва в .env");
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
