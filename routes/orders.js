// routes/orders.js
const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");

const router = express.Router();

function toSafeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * POST /orders
 * Създаване на поръчка от публичната част
 */
router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const customerName = String(body.customerName || "").trim();
    const phone = String(body.phone || "").trim();
    const city = String(body.city || "").trim();
    const address = String(body.address || "").trim();
    const note = String(body.note || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!customerName || !phone) {
      return res.status(400).json({
        message: "Името и телефонът са задължителни.",
      });
    }

    if (!items.length) {
      return res.status(400).json({
        message: "Количката е празна.",
      });
    }

    const productIds = items
      .map((x) => x.productId || x._id)
      .filter(Boolean);

    const products = await Product.find({
      _id: { $in: productIds },
      status: "approved",
      isActive: true,
    }).lean();

    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const normalizedItems = [];
    let total = 0;

    for (const raw of items) {
      const id = String(raw.productId || raw._id || "").trim();
      const qty = Math.max(1, toSafeNumber(raw.qty, 1));
      const product = productMap.get(id);

      if (!product) continue;

      const price =
        product.finalPrice != null
          ? toSafeNumber(product.finalPrice, 0)
          : toSafeNumber(product.price, 0);

      normalizedItems.push({
        productId: product._id,
        title: product.title,
        imageUrl:
          (Array.isArray(product.images) && product.images[0]) ||
          product.imageUrl ||
          "",
        price,
        qty,
      });

      total += price * qty;
    }

    if (!normalizedItems.length) {
      return res.status(400).json({
        message: "Няма валидни продукти в поръчката.",
      });
    }

    const order = await Order.create({
      customerName,
      phone,
      city,
      address,
      note,
      items: normalizedItems,
      total: +total.toFixed(2),
      currency: "BGN",
    });

    return res.status(201).json({
      ok: true,
      message: "Поръчката е приета успешно.",
      order,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Грешка при създаване на поръчка.",
      error: err.message,
    });
  }
});

/**
 * GET /orders/admin
 * Списък с поръчки за админ
 */
router.get("/admin", auth, adminOnly, async (req, res) => {
  try {
    const status = String(req.query.status || "all").trim().toLowerCase();

    const filter = {};
    if (status !== "all") filter.status = status;

    const items = await Order.find(filter).sort({ createdAt: -1 });

    return res.json({
      ok: true,
      items,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Грешка при зареждане на поръчките.",
      error: err.message,
    });
  }
});

/**
 * PATCH /orders/admin/:id/status
 * Смяна на статус на поръчка
 */
router.patch("/admin/:id/status", auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const status = String(req.body?.status || "").trim().toLowerCase();

    if (!["new", "confirmed", "shipped", "delivered", "cancelled"].includes(status)) {
      return res.status(400).json({
        message: "Невалиден статус.",
      });
    }

    const updated = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        message: "Поръчката не е намерена.",
      });
    }

    return res.json({
      ok: true,
      order: updated,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Грешка при смяна на статуса.",
      error: err.message,
    });
  }
});

module.exports = router;