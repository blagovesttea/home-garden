import "./PropertyDetails.css";

export default function PropertyDetails({
  navigate,
  clearPublicFilters,
  productPageLoading,
  productPageMsg,
  productPage,
  applyCategoryFilter,
  categoryLabelFromValue,
  activeProductImage,
  activeProductImages,
  productGalleryIndex,
  setProductGalleryIndex,
  formatPrice,
  productPrice,
  addToCart,
  setCartOpen,
  relatedLoading,
  relatedProducts,
  productImage,
  openProduct,
}) {
  if (!productPage) return null;

  const stockLabel =
    productPage?.stockStatus === "in_stock"
      ? "В наличност"
      : productPage?.stockStatus === "out_of_stock"
      ? "Изчерпан"
      : "Наличност: неизвестна";

  const shippingLabel = productPage?.shippingDays
    ? `${productPage.shippingDays} дни`
    : "По договаряне";

  const weightLabel = productPage?.weight
    ? `${productPage.weight}${
        productPage.weightUnit ? ` ${productPage.weightUnit}` : ""
      }`
    : "Няма информация";

  const intensityLabel = productPage?.intensity || "Няма информация";
  const stockQtyLabel = productPage?.stockQty ?? "—";
  const roastLabel = productPage?.roastLevel || "Няма информация";
  const caffeineLabel = productPage?.caffeineType || "Няма информация";

  const categoryLabel = productPage?.category
    ? categoryLabelFromValue(productPage.category)
    : "Продукт";

  const detailRows = [
    { label: "Наличност", value: stockQtyLabel },
    { label: "Доставка", value: shippingLabel },
    { label: "Грамаж", value: weightLabel },
    { label: "Интензитет", value: intensityLabel },
    { label: "Изпичане", value: roastLabel },
    { label: "Кофеин", value: caffeineLabel },
    ...(productPage?.brand ? [{ label: "Марка", value: productPage.brand }] : []),
    ...(productPage?.sku ? [{ label: "SKU", value: productPage.sku }] : []),
  ];

  return (
    <div className="hg-publicShell hg-productDetailsPage">
      <div className="hg-productDetailsTopbar">
        <div className="hg-productDetailsTopbar__inner">
          <button className="hg-btn" onClick={() => navigate(-1)}>
            Назад
          </button>
          <button className="hg-btn" onClick={clearPublicFilters}>
            Към каталога
          </button>
        </div>
      </div>

      {productPageLoading && (
        <div className="hg-productDetailsState">Зареждане…</div>
      )}

      {productPageMsg && (
        <div className="hg-productDetailsState">{productPageMsg}</div>
      )}

      {!productPageLoading && !productPageMsg && (
        <>
          <div className="hg-productDetailsBreadcrumbs">
            <div className="hg-productDetailsBreadcrumbs__inner">
              <button
                type="button"
                className="hg-productDetailsBreadcrumbLink"
                onClick={clearPublicFilters}
              >
                Начало
              </button>

              <span className="hg-productDetailsBreadcrumbSep">/</span>

              <button
                type="button"
                className="hg-productDetailsBreadcrumbLink"
                onClick={() => {
                  if (productPage?.category) {
                    applyCategoryFilter(productPage.category);
                  } else {
                    clearPublicFilters();
                  }
                }}
              >
                {categoryLabel}
              </button>

              <span className="hg-productDetailsBreadcrumbSep">/</span>

              <span className="hg-productDetailsBreadcrumbCurrent">
                {productPage.title}
              </span>
            </div>
          </div>

          <div className="hg-productDetailsLayout">
            <div className="hg-productDetailsGallery">
              <div className="hg-productDetailsHeroWrap">
                <div
                  className="hg-productDetailsHeroImage"
                  style={{
                    backgroundImage: activeProductImage
                      ? `url("${activeProductImage}")`
                      : "linear-gradient(135deg,#ece7e2,#f7f3ef)",
                  }}
                />

                <div className="hg-productDetailsHeroBadges">
                  <span className="hg-productDetailsBadge">
                    {categoryLabel}
                  </span>
                  <span
                    className={`hg-productDetailsBadge ${
                      productPage?.stockStatus === "in_stock"
                        ? "is-instock"
                        : productPage?.stockStatus === "out_of_stock"
                        ? "is-outofstock"
                        : ""
                    }`}
                  >
                    {stockLabel}
                  </span>
                </div>
              </div>

              {activeProductImages.length > 1 && (
                <div className="hg-productDetailsThumbs">
                  {activeProductImages.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`hg-productDetailsThumbBtn ${
                        idx === productGalleryIndex ? "is-active" : ""
                      }`}
                      onClick={() => setProductGalleryIndex(idx)}
                      aria-label={`Снимка ${idx + 1}`}
                    >
                      <div
                        className="hg-productDetailsThumb"
                        style={{ backgroundImage: `url("${img}")` }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="hg-productDetailsContent">
              <div className="hg-productDetailsHeader">
                <div className="hg-productDetailsEyebrow">
                  {productPage?.brand ? productPage.brand : categoryLabel}
                </div>

                <h1 className="hg-productDetailsTitle">{productPage.title}</h1>

                <div className="hg-productDetailsMetaRow">
                  <span className="hg-productDetailsMetaItem">{stockLabel}</span>
                  {productPage?.shippingDays ? (
                    <>
                      <span className="hg-productDetailsMetaDot">•</span>
                      <span className="hg-productDetailsMetaItem">
                        Доставка: {shippingLabel}
                      </span>
                    </>
                  ) : null}
                </div>

                <div className="hg-productDetailsPrice">
                  {formatPrice(
                    productPrice(productPage),
                    productPage.currency
                  )}
                </div>
              </div>

              {productPage.shortDescription && (
                <div className="hg-productDetailsLead">
                  {productPage.shortDescription}
                </div>
              )}

              <div className="hg-productDetailsActions">
                <button
                  className="hg-btn hg-btn--primary"
                  onClick={() => addToCart(productPage)}
                >
                  Добави в количката
                </button>

                <button
                  className="hg-btn"
                  onClick={() => {
                    addToCart(productPage);
                    setCartOpen(true);
                  }}
                >
                  Добави и отвори количката
                </button>
              </div>

              <div className="hg-productDetailsInfoGrid">
                <div className="hg-productDetailsCard">
                  <div className="hg-productDetailsCardTitle">
                    Основна информация
                  </div>

                  <div className="hg-productDetailsSpecs">
                    {detailRows.map((row) => (
                      <div className="hg-productDetailsSpec" key={row.label}>
                        <span className="hg-productDetailsSpecLabel">
                          {row.label}
                        </span>
                        <b className="hg-productDetailsSpecValue">
                          {row.value}
                        </b>
                      </div>
                    ))}
                  </div>
                </div>

                {productPage.description && (
                  <div className="hg-productDetailsCard">
                    <div className="hg-productDetailsCardTitle">
                      Описание
                    </div>
                    <div className="hg-productDetailsText">
                      {productPage.description}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {!productPageLoading && !productPageMsg && relatedProducts.length > 0 && (
        <section className="hg-productDetailsRelated">
          <div className="hg-productDetailsSectionHead">
            <div>
              <div className="hg-productDetailsSectionEyebrow">
                Подбрани предложения
              </div>
              <h2 className="hg-productDetailsSectionTitle">
                Свързани продукти
              </h2>
            </div>
          </div>

          {relatedLoading ? (
            <div className="hg-productDetailsState">Зареждане…</div>
          ) : (
            <div className="hg-productDetailsRelatedGrid">
              {relatedProducts.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  className="hg-productDetailsRelatedCard"
                  onClick={() => openProduct(p)}
                >
                  <div
                    className="hg-productDetailsRelatedThumb"
                    style={{
                      backgroundImage: productImage(p)
                        ? `url("${productImage(p)}")`
                        : "linear-gradient(135deg,#eee,#f7f7f7)",
                    }}
                  />
                  <div className="hg-productDetailsRelatedBody">
                    <div className="hg-productDetailsRelatedCategory">
                      {p?.category
                        ? categoryLabelFromValue(p.category)
                        : "Продукт"}
                    </div>

                    <h3 className="hg-productDetailsRelatedCardTitle">
                      {p.title}
                    </h3>

                    <div className="hg-productDetailsRelatedPrice">
                      {formatPrice(productPrice(p), p.currency)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}