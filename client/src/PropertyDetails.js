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
  openProduct,
  productImage,
}) {
  const stockLabel =
    productPage?.stockStatus === "in_stock"
      ? "В наличност"
      : productPage?.stockStatus === "out_of_stock"
      ? "Изчерпан"
      : "Наличност: неизвестна";

  const shippingLabel = productPage?.shippingDays
    ? `${productPage.shippingDays} дни`
    : "По договаряне";

  const weightLabel =
    productPage?.weight !== undefined &&
    productPage?.weight !== null &&
    productPage?.weight !== ""
      ? `${productPage.weight}${
          productPage.weightUnit ? ` ${productPage.weightUnit}` : ""
        }`
      : "Няма информация";

  const intensityLabel =
    productPage?.intensity !== undefined &&
    productPage?.intensity !== null &&
    productPage?.intensity !== ""
      ? productPage.intensity
      : "Няма информация";

  const stockQtyLabel =
    productPage?.stockQty !== undefined &&
    productPage?.stockQty !== null &&
    productPage?.stockQty !== ""
      ? productPage.stockQty
      : "—";

  const roastLabel = productPage?.roastLevel || "Няма информация";
  const caffeineLabel = productPage?.caffeineType || "Няма информация";
  const priceLabel = productPage
    ? formatPrice(productPrice(productPage), productPage.currency)
    : "";

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

      {productPageLoading && <div className="hg-panel">Зареждане…</div>}

      {!productPageLoading && productPageMsg && (
        <div className="hg-panel hg-panel--bad">{productPageMsg}</div>
      )}

      {!productPageLoading && !productPageMsg && productPage && (
        <>
          <section className="hg-productDetailsBreadcrumbs">
            <div className="hg-productDetailsBreadcrumbs__inner">
              <button className="hg-btn" onClick={clearPublicFilters}>
                Начало
              </button>

              <span className="hg-productDetailsBreadcrumbs__sep">/</span>

              <button
                className="hg-btn"
                onClick={() => applyCategoryFilter(productPage.category || "all")}
              >
                {categoryLabelFromValue(productPage.category) || "Продукти"}
              </button>

              <span className="hg-productDetailsBreadcrumbs__sep">/</span>

              <b className="hg-productDetailsBreadcrumbs__current">
                {productPage.title}
              </b>
            </div>
          </section>

          <section className="hg-productDetailsMainPanel">
            <div className="hg-productDetailsLayout">
              <div className="hg-productDetailsGallery">
                <div
                  className="hg-productDetailsHeroImage"
                  style={{
                    backgroundImage: activeProductImage
                      ? `url("${activeProductImage}")`
                      : "linear-gradient(135deg,#ece7e2,#f7f3ef)",
                  }}
                />

                {activeProductImages.length > 1 ? (
                  <div className="hg-productDetailsThumbs">
                    {activeProductImages.map((img, idx) => (
                      <button
                        key={`${img}-${idx}`}
                        type="button"
                        className={`hg-productDetailsThumbBtn ${
                          idx === productGalleryIndex ? "is-active" : ""
                        }`}
                        onClick={() => setProductGalleryIndex(idx)}
                        aria-label={`Снимка ${idx + 1}`}
                      >
                        <div
                          className="hg-productDetailsThumb"
                          style={{
                            backgroundImage: `url("${img}")`,
                          }}
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="hg-productDetailsContent">
                <div className="hg-productDetailsMeta">
                  {productPage.category ? (
                    <span className="hg-productDetailsPill">
                      {categoryLabelFromValue(productPage.category)}
                    </span>
                  ) : null}

                  {productPage.brand ? (
                    <span className="hg-productDetailsPill">
                      {productPage.brand}
                    </span>
                  ) : null}

                  <span className="hg-productDetailsPill">{stockLabel}</span>
                </div>

                <h1 className="hg-productDetailsTitle">{productPage.title}</h1>

                <div className="hg-productDetailsPrice">{priceLabel}</div>

                {productPage.shortDescription ? (
                  <div className="hg-productDetailsText">
                    {productPage.shortDescription}
                  </div>
                ) : null}

                {productPage.description ? (
                  <div className="hg-productDetailsText">
                    {productPage.description}
                  </div>
                ) : null}

                <div className="hg-productDetailsSpecs">
                  <div className="hg-productDetailsSpec">
                    <span className="hg-productDetailsSpecLabel">Наличност</span>
                    <b className="hg-productDetailsSpecValue">{stockQtyLabel}</b>
                  </div>

                  <div className="hg-productDetailsSpec">
                    <span className="hg-productDetailsSpecLabel">Доставка</span>
                    <b className="hg-productDetailsSpecValue">{shippingLabel}</b>
                  </div>

                  <div className="hg-productDetailsSpec">
                    <span className="hg-productDetailsSpecLabel">Грамаж</span>
                    <b className="hg-productDetailsSpecValue">{weightLabel}</b>
                  </div>

                  <div className="hg-productDetailsSpec">
                    <span className="hg-productDetailsSpecLabel">Интензитет</span>
                    <b className="hg-productDetailsSpecValue">{intensityLabel}</b>
                  </div>

                  <div className="hg-productDetailsSpec">
                    <span className="hg-productDetailsSpecLabel">Изпичане</span>
                    <b className="hg-productDetailsSpecValue">{roastLabel}</b>
                  </div>

                  <div className="hg-productDetailsSpec">
                    <span className="hg-productDetailsSpecLabel">Кофеин</span>
                    <b className="hg-productDetailsSpecValue">{caffeineLabel}</b>
                  </div>

                  {productPage.sku ? (
                    <div className="hg-productDetailsSpec">
                      <span className="hg-productDetailsSpecLabel">SKU</span>
                      <b className="hg-productDetailsSpecValue">
                        {productPage.sku}
                      </b>
                    </div>
                  ) : null}
                </div>

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

                  <button
                    className="hg-btn"
                    onClick={() => applyCategoryFilter(productPage.category || "all")}
                  >
                    Виж още от категорията
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="hg-productDetailsRelated">
            <div className="hg-productDetailsRelatedTitle">Подобни продукти</div>

            {relatedLoading ? (
              <div className="hg-productDetailsRelatedState">Зареждане…</div>
            ) : relatedProducts.length === 0 ? (
              <div className="hg-productDetailsRelatedState">
                Няма други продукти в тази категория.
              </div>
            ) : (
              <div className="hg-productDetailsRelatedGrid">
                {relatedProducts.map((p) => (
                  <div className="hg-productDetailsRelatedCard" key={p._id}>
                    <div
                      className="hg-productDetailsRelatedThumb"
                      style={{
                        backgroundImage: productImage(p)
                          ? `url("${productImage(p)}")`
                          : "linear-gradient(135deg,#eee,#f7f7f7)",
                      }}
                    />

                    <div className="hg-productDetailsRelatedBody">
                      <div className="hg-productDetailsRelatedMeta">
                        {p.brand ? (
                          <span className="hg-productDetailsRelatedPill">
                            {p.brand}
                          </span>
                        ) : null}
                        <span className="hg-productDetailsRelatedPill">
                          {categoryLabelFromValue(p.category)}
                        </span>
                      </div>

                      <h3 className="hg-productDetailsRelatedCardTitle">
                        {p.title}
                      </h3>

                      <div className="hg-productDetailsRelatedPrice">
                        {formatPrice(productPrice(p), p.currency)}
                      </div>

                      <div className="hg-productDetailsRelatedActions">
                        <button
                          className="hg-btn"
                          type="button"
                          onClick={() => openProduct(p)}
                        >
                          Детайли
                        </button>

                        <button
                          className="hg-btn hg-btn--primary"
                          type="button"
                          onClick={() => addToCart(p)}
                        >
                          Добави
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}