// services/categorizer.js

async function categorizeProduct() {
  return {
    categoryId: null,
    categoryPath: [],
    legacyCategory: "other",
  };
}

module.exports = { categorizeProduct };