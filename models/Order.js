// models/Order.js
const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    city: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },

    items: {
      type: [OrderItemSchema],
      default: [],
      validate: {
        validator: Array.isArray,
        message: "items трябва да е масив",
      },
    },

    total: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, default: "BGN", trim: true },

    status: {
      type: String,
      enum: ["new", "confirmed", "shipped", "delivered", "cancelled"],
      default: "new",
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ phone: 1 });

module.exports = mongoose.model("Order", OrderSchema);