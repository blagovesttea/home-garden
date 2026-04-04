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
                    <span className="hg-pill">
                      {categoryLabelFromValue(productPage.category)}
                    </span>
                  ) : null}

                  {productPage.brand ? (
                    <span className="hg-pill">{productPage.brand}</span>
                  ) : null}

                  {productPage.sku ? (
                    <span className="hg-pill">SKU: {productPage.sku}</span>
                  ) : null}

                  <span className="hg-pill">{stockLabel}</span>
                </div>

                <h1 className="hg-productDetailsTitle">{productPage.title}</h1>

                <div className="hg-productDetailsPrice">
                  {formatPrice(productPrice(productPage), productPage.currency)}
                </div>

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
                  <div className="hg-kpis">
                    Наличност:
                    <b>
                      {productPage.stockQty !== undefined &&
                      productPage.stockQty !== null &&
                      productPage.stockQty !== ""
                        ? productPage.stockQty
                        : "-"}
                    </b>
                  </div>

                  <div className="hg-kpis">
                    Доставка:
                    <b>
                      {productPage.shippingDays
                        ? `${productPage.shippingDays} дни`
                        : "—"}
                    </b>
                  </div>

                  <div className="hg-kpis">
                    Грамаж:
                    <b>
                      {productPage.weight !== undefined &&
                      productPage.weight !== null &&
                      productPage.weight !== ""
                        ? `${productPage.weight}${
                            productPage.weightUnit ? ` ${productPage.weightUnit}` : ""
                          }`
                        : "-"}
                    </b>
                  </div>

                  <div className="hg-kpis">
                    Интензитет:
                    <b>
                      {productPage.intensity !== undefined &&
                      productPage.intensity !== null &&
                      productPage.intensity !== ""
                        ? productPage.intensity
                        : "-"}
                    </b>
                  </div>

                  <div className="hg-kpis">
                    Изпичане:
                    <b>{productPage.roastLevel || "-"}</b>
                  </div>

                  <div className="hg-kpis">
                    Кофеин:
                    <b>{productPage.caffeineType || "-"}</b>
                  </div>
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
                </div>
              </div>
            </div>
          </section>

          <section className="hg-productDetailsRelated">
            <div className="hg-panelTitle">Подобни продукти</div>

            {relatedLoading ? (
              <div className="hg-kpis">Зареждане…</div>
            ) : relatedProducts.length === 0 ? (
              <div className="hg-kpis">Няма други продукти в тази категория.</div>
            ) : (
              <div className="hg-grid">
                {relatedProducts.map((p) => (
                  <div className="hg-card" key={p._id}>
                    <div
                      className="hg-thumb"
                      style={{
                        backgroundImage: productImage(p)
                          ? `url("${productImage(p)}")`
                          : "linear-gradient(135deg,#eee,#f7f7f7)",
                      }}
                    />

                    <div className="hg-cardBody">
                      <h3 className="hg-cardTitle">{p.title}</h3>

                      <div className="hg-meta">
                        {p.brand ? <span className="hg-pill">{p.brand}</span> : null}
                        <span className="hg-pill">
                          {categoryLabelFromValue(p.category)}
                        </span>
                      </div>

                      <div className="hg-price">
                        {formatPrice(productPrice(p), p.currency)}
                      </div>

                      <div className="hg-actions">
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