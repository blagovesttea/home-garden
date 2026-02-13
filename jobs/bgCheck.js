require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");

// MVP: засега ще маркираме всички unknown като "no" (по-късно ще го сменим с реална проверка в BG)
async function run() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI липсва");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ bgCheck connected to MongoDB");

  const r = await Product.updateMany(
    { "bg.foundInBG": "unknown" },
    { $set: { "bg.foundInBG": "no" } }
  );

  console.log("✅ bgCheck done");
  console.log("matched:", r.matchedCount ?? r.n);
  console.log("modified:", r.modifiedCount ?? r.nModified);

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error("❌ bgCheck error:", e.message);
  process.exit(1);
});
