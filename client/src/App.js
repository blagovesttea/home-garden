import { useEffect, useMemo, useState } from "react";
import { Routes, Route } from "react-router-dom";
import "./App.css";

// API base
const API =
  process.env.NODE_ENV === "production"
    ? window.location.origin
    : "http://localhost:8000";

const ADMIN_STATUSES = ["all", "new", "approved", "rejected", "blacklisted"];

const ADMIN_STATUS_LABELS = {
  all: "Всички",
  new: "Нови",
  approved: "Одобрени",
  rejected: "Отхвърлени",
  blacklisted: "Черен списък",
};

const SORTS = [
  { value: "featured", label: "Препоръчани" },
  { value: "newest", label: "Най-нови" },
  { value: "popular", label: "Най-популярни" },
  { value: "priceAsc", label: "Цена (ниска → висока)" },
  { value: "priceDesc", label: "Цена (висока → ниска)" },
];

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatPrice(v, currency = "BGN") {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} ${currency}`;
}

function productPrice(p) {
  return p?.finalPrice != null ? p.finalPrice : p?.price;
}

function productImage(p) {
  if (Array.isArray(p?.images) && p.images.length) return p.images[0];
  if (p?.imageUrl) return p.imageUrl;
  return "";
}

function cartStorageKey() {
  return "moto_cart_v1";
}

function emptyProductForm() {
  return {
    title: "",
    shortDescription: "",
    description: "",
    brand: "",
    sku: "",
    category: "other",
    source: "manual",
    sourceUrl: "",
    imageUrl: "",
    imagesText: "",
    price: "",
    basePrice: "",
    markupType: "none",
    markupValue: "",
    finalPrice: "",
    currency: "BGN",
    shippingPrice: "0",
    shippingToBG: true,
    shippingDays: "",
    stockStatus: "in_stock",
    stockQty: "",
    isActive: true,
    isFeatured: false,
    status: "new",
  };
}

function AppShell() {
  /* =========================
     AUTH / ADMIN
  ========================== */
  const [view, setView] = useState("public");

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem("token") || "";
    } catch {
      return "";
    }
  });

  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(false);
  const isAdmin = me?.role === "admin";

  const [loginEmail, setLoginEmail] = useState("test@test.com");
  const [loginPass, setLoginPass] = useState("Test1234");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMsg, setAuthMsg] = useState("");

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  async function apiFetch(path, opts = {}) {
    const hasBody = opts.body != null;

    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: {
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...authHeaders,
        ...(opts.headers || {}),
      },
    });

    const text = await res.text();

    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const msg =
        data?.message ||
        data?.error ||
        (text?.includes("<!doctype") || text?.includes("<html")
          ? "Сървърът върна HTML вместо JSON."
          : `HTTP ${res.status}`);
      throw new Error(msg);
    }

    return data;
  }

  useEffect(() => {
    let aborted = false;

    async function loadMe() {
      setAuthMsg("");

      if (!token) {
        setMe(null);
        setMeLoading(false);
        return;
      }

      setMeLoading(true);

      try {
        const data = await apiFetch("/auth/me", { method: "GET" });
        if (aborted) return;
        setMe(data?.user || null);
      } catch {
        if (aborted) return;
        setMe(null);
        setToken("");
        try {
          localStorage.removeItem("token");
        } catch {}
        setAuthMsg("Сесията е изтекла. Влез отново.");
        setView("public");
      } finally {
        if (!aborted) setMeLoading(false);
      }
    }

    loadMe();
    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function doLogin(e) {
    e?.preventDefault?.();
    setAuthLoading(true);
    setAuthMsg("");

    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      });

      const t = data?.token || data?.accessToken || data?.data?.token || "";
      if (!t) throw new Error("Не е върнат токен");

      setToken(t);
      try {
        localStorage.setItem("token", t);
      } catch {}

      setView("admin");
      setAuthMsg("Успешен вход");
    } catch (e2) {
      setAuthMsg(e2?.message || "Грешка при вход");
    } finally {
      setAuthLoading(false);
    }
  }

  function doLogout() {
    setMe(null);
    setToken("");
    setAuthMsg("");
    setMeLoading(false);
    setView("public");
    try {
      localStorage.removeItem("token");
    } catch {}
  }

  /* =========================
     PUBLIC PRODUCTS
  ========================== */
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [sort, setSort] = useState("featured");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [qDebounced, sort]);

  useEffect(() => {
    let aborted = false;

    async function loadProducts() {
      if (view !== "public") return;

      setLoading(true);
      setErrMsg("");

      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        params.set("sort", sort);
        if (qDebounced) params.set("q", qDebounced);

        const data = await apiFetch(`/products?${params.toString()}`, {
          method: "GET",
        });

        if (aborted) return;

        const items = Array.isArray(data?.items) ? data.items : [];
        setProducts(items);
        setMeta({
          total: Number(data?.total || items.length || 0),
          page: Number(data?.page || page),
          limit: Number(data?.limit || limit),
        });
      } catch (e) {
        if (!aborted) {
          setErrMsg(e?.message || "Грешка при зареждане");
          setProducts([]);
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    loadProducts();
    return () => {
      aborted = true;
    };
  }, [view, qDebounced, sort, page, limit]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || 20)));
  }, [meta]);

  /* =========================
     PRODUCT MODAL
  ========================== */
  const [selectedProduct, setSelectedProduct] = useState(null);

  async function openProduct(product) {
    setSelectedProduct(product);
    try {
      await fetch(`${API}/products/${product._id}/view`);
    } catch {}
  }

  function closeProduct() {
    setSelectedProduct(null);
  }

  /* =========================
     CART
  ========================== */
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState(() => {
    try {
      const raw = localStorage.getItem(cartStorageKey());
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(cartStorageKey(), JSON.stringify(cart));
    } catch {}
  }, [cart]);

  function addToCart(product) {
    if (!product?._id) return;

    setCart((prev) => {
      const idx = prev.findIndex((x) => x._id === product._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          qty: next[idx].qty + 1,
        };
        return next;
      }

      return [
        ...prev,
        {
          _id: product._id,
          title: product.title,
          price: productPrice(product),
          currency: product.currency || "BGN",
          imageUrl: productImage(product),
          qty: 1,
        },
      ];
    });
  }

  function decreaseQty(id) {
    setCart((prev) =>
      prev
        .map((x) => (x._id === id ? { ...x, qty: x.qty - 1 } : x))
        .filter((x) => x.qty > 0)
    );
  }

  function increaseQty(id) {
    setCart((prev) =>
      prev.map((x) => (x._id === id ? { ...x, qty: x.qty + 1 } : x))
    );
  }

  function removeFromCart(id) {
    setCart((prev) => prev.filter((x) => x._id !== id));
  }

  function clearCart() {
    setCart([]);
  }

  const cartCount = useMemo(
    () => cart.reduce((sum, x) => sum + toNum(x.qty), 0),
    [cart]
  );

  const cartTotal = useMemo(
    () => cart.reduce((sum, x) => sum + toNum(x.price) * toNum(x.qty), 0),
    [cart]
  );

  /* =========================
     ADMIN
  ========================== */
  const [adminStatus, setAdminStatus] = useState("new");
  const [adminItems, setAdminItems] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMsg, setAdminMsg] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [productForm, setProductForm] = useState(emptyProductForm());
  const [formLoading, setFormLoading] = useState(false);

  async function loadAdmin() {
    if (!token) {
      setAdminMsg("Няма токен. Влез първо.");
      return;
    }
    if (!isAdmin) {
      setAdminMsg("Нямаш админ права.");
      return;
    }

    setAdminLoading(true);
    setAdminMsg("");

    try {
      const qs = new URLSearchParams();
      if (adminStatus && adminStatus !== "all") qs.set("status", adminStatus);

      const data = await apiFetch(`/admin/products?${qs.toString()}`, {
        method: "GET",
      });

      setAdminItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setAdminMsg(e?.message || "Грешка при зареждане");
      setAdminItems([]);
    } finally {
      setAdminLoading(false);
    }
  }

  useEffect(() => {
    if (view !== "admin") return;
    if (!token) return;
    if (meLoading) return;
    if (!isAdmin) return;

    loadAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, token, meLoading, isAdmin, adminStatus]);

  async function setStatus(id, status) {
    setAdminMsg("");
    try {
      await apiFetch(`/admin/products/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadAdmin();
    } catch (e) {
      setAdminMsg(e?.message || "Грешка при промяна на статус");
    }
  }

  async function deleteProduct(id) {
    setAdminMsg("");
    try {
      await apiFetch(`/admin/products/${id}`, { method: "DELETE" });
      await loadAdmin();
    } catch (e) {
      setAdminMsg(e?.message || "Грешка при изтриване");
    }
  }

  async function approveExistingNew() {
    setAdminMsg("");
    try {
      const r = await apiFetch(`/admin/products/approve-existing`, {
        method: "POST",
      });
      setAdminMsg(
        `Одобрени: matched ${r?.matched ?? "-"} / modified ${r?.modified ?? "-"}`
      );
      await loadAdmin();
    } catch (e) {
      setAdminMsg(e?.message || "Грешка при масово одобрение");
    }
  }

  function openCreateForm() {
    setEditingId("");
    setProductForm(emptyProductForm());
    setFormOpen(true);
    setAdminMsg("");
  }

  function openEditForm(product) {
    setEditingId(product?._id || "");
    setProductForm({
      title: product?.title || "",
      shortDescription: product?.shortDescription || "",
      description: product?.description || "",
      brand: product?.brand || "",
      sku: product?.sku || "",
      category: product?.category || "other",
      source: product?.source || "manual",
      sourceUrl: product?.sourceUrl || "",
      imageUrl: product?.imageUrl || "",
      imagesText: Array.isArray(product?.images) ? product.images.join("\n") : "",
      price: product?.price ?? "",
      basePrice: product?.basePrice ?? "",
      markupType: product?.markupType || "none",
      markupValue: product?.markupValue ?? "",
      finalPrice: product?.finalPrice ?? "",
      currency: product?.currency || "BGN",
      shippingPrice: product?.shippingPrice ?? 0,
      shippingToBG:
        typeof product?.shippingToBG === "boolean" ? product.shippingToBG : true,
      shippingDays: product?.shippingDays ?? "",
      stockStatus: product?.stockStatus || "in_stock",
      stockQty: product?.stockQty ?? "",
      isActive:
        typeof product?.isActive === "boolean" ? product.isActive : true,
      isFeatured:
        typeof product?.isFeatured === "boolean" ? product.isFeatured : false,
      status: product?.status || "new",
    });
    setFormOpen(true);
    setAdminMsg("");
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId("");
    setProductForm(emptyProductForm());
    setFormLoading(false);
  }

  function updateFormField(key, value) {
    setProductForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function submitProductForm(e) {
    e?.preventDefault?.();
    setFormLoading(true);
    setAdminMsg("");

    try {
      const images = String(productForm.imagesText || "")
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);

      const payload = {
        title: String(productForm.title || "").trim(),
        shortDescription: String(productForm.shortDescription || "").trim(),
        description: String(productForm.description || "").trim(),
        brand: String(productForm.brand || "").trim(),
        sku: String(productForm.sku || "").trim(),
        category: String(productForm.category || "other").trim(),
        source: String(productForm.source || "manual").trim(),
        sourceUrl: String(productForm.sourceUrl || "").trim(),
        imageUrl: String(productForm.imageUrl || "").trim(),
        images,
        price: productForm.price === "" ? null : toNum(productForm.price),
        basePrice:
          productForm.basePrice === "" ? null : toNum(productForm.basePrice),
        markupType: productForm.markupType || "none",
        markupValue:
          productForm.markupValue === "" ? 0 : toNum(productForm.markupValue),
        finalPrice:
          productForm.finalPrice === "" ? null : toNum(productForm.finalPrice),
        currency: String(productForm.currency || "BGN").trim(),
        shippingPrice:
          productForm.shippingPrice === "" ? 0 : toNum(productForm.shippingPrice),
        shippingToBG: !!productForm.shippingToBG,
        shippingDays:
          productForm.shippingDays === "" ? null : toNum(productForm.shippingDays),
        stockStatus: productForm.stockStatus || "unknown",
        stockQty:
          productForm.stockQty === "" ? null : toNum(productForm.stockQty),
        isActive: !!productForm.isActive,
        isFeatured: !!productForm.isFeatured,
        status: productForm.status || "new",
      };

      if (!payload.title) {
        throw new Error("Заглавието е задължително");
      }

      if (!editingId) {
        await apiFetch("/admin/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setAdminMsg("Продуктът е добавен успешно.");
      } else {
        await apiFetch(`/admin/products/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setAdminMsg("Продуктът е редактиран успешно.");
      }

      closeForm();
      await loadAdmin();
    } catch (e2) {
      setAdminMsg(e2?.message || "Грешка при запис");
    } finally {
      setFormLoading(false);
    }
  }

  /* =========================
     UI
  ========================== */
  return (
    <div className={`hg ${view === "public" ? "hg--public" : "hg--admin"}`}>
      <div className="hg-topbar">
        <div className="hg-brand">
          <div>
            <h1 className="hg-title">Moto Аксесоари</h1>
            <div className="hg-sub">
              {view === "public"
                ? "Визьори, механизми, пинове и аксесоари за каски"
                : "Админ панел"}
            </div>
          </div>
        </div>

        <div className="hg-topActions">
          {view === "public" && (
            <button
              className="hg-btn hg-btn--primary"
              onClick={() => setCartOpen(true)}
            >
              Количка ({cartCount})
            </button>
          )}

          <div className="hg-switch">
            <button
              className={`hg-switchBtn ${view === "public" ? "is-active" : ""}`}
              onClick={() => setView("public")}
              disabled={view === "public"}
            >
              Магазин
            </button>

            <button
              className={`hg-switchBtn ${view === "admin" ? "is-active" : ""}`}
              onClick={() => setView("admin")}
              disabled={view === "admin"}
            >
              Админ
            </button>
          </div>

          {token ? (
            <>
              <div className="hg-userChip">
                роля: <b>{me?.role || (meLoading ? "проверка..." : "неизвестна")}</b>
              </div>
              <button className="hg-btn" onClick={doLogout}>
                Изход
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* ADMIN LOGIN */}
      {view === "admin" && !token && (
        <form className="hg-panel" onSubmit={doLogin}>
          <div className="hg-panelTitle">Админ вход</div>

          <div className="hg-loginGrid">
            <input
              className="hg-input"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="имейл"
              autoComplete="email"
            />
            <input
              className="hg-input"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              placeholder="парола"
              type="password"
              autoComplete="current-password"
            />
            <button
              className="hg-btn hg-btn--primary"
              type="submit"
              disabled={authLoading}
            >
              {authLoading ? "..." : "Вход"}
            </button>
          </div>

          {authMsg && <div className="hg-note">{authMsg}</div>}
        </form>
      )}

      {view === "admin" && token && meLoading && (
        <div className="hg-panel">Проверка на права…</div>
      )}
      {view === "admin" && token && authMsg && !meLoading && (
        <div className="hg-panel">{authMsg}</div>
      )}

      {/* ADMIN PANEL */}
      {view === "admin" && (
        <div>
          {!token ? (
            <div className="hg-panel hg-panel--bad">Влез първо.</div>
          ) : meLoading ? null : !isAdmin ? (
            <div className="hg-panel hg-panel--bad">
              Нямаш админ права.
            </div>
          ) : (
            <>
              <div className="hg-toolbar">
                <select
                  className="hg-select"
                  value={adminStatus}
                  onChange={(e) => setAdminStatus(e.target.value)}
                >
                  {ADMIN_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {ADMIN_STATUS_LABELS[s] || s}
                    </option>
                  ))}
                </select>

                <button
                  className="hg-btn"
                  onClick={loadAdmin}
                  disabled={adminLoading}
                >
                  Обнови
                </button>

                <button
                  className="hg-btn"
                  onClick={approveExistingNew}
                  disabled={adminLoading}
                >
                  Одобри всички нови
                </button>

                <button
                  className="hg-btn hg-btn--primary"
                  onClick={openCreateForm}
                  disabled={adminLoading}
                >
                  Нов продукт
                </button>

                <div className="hg-counter">
                  Продукти: <b>{adminItems.length}</b>
                </div>

                <button className="hg-btn" onClick={doLogout}>
                  Изход
                </button>
              </div>

              {adminMsg && <div className="hg-panel">{adminMsg}</div>}
              {adminLoading && <div className="hg-panel">Зареждане…</div>}

              {formOpen && (
                <form className="hg-panel hg-productForm" onSubmit={submitProductForm}>
                  <div className="hg-panelTitle">
                    {editingId ? "Редакция на продукт" : "Нов продукт"}
                  </div>

                  <div className="hg-formGrid">
                    <input
                      className="hg-input"
                      placeholder="Заглавие"
                      value={productForm.title}
                      onChange={(e) => updateFormField("title", e.target.value)}
                    />

                    <input
                      className="hg-input"
                      placeholder="Марка"
                      value={productForm.brand}
                      onChange={(e) => updateFormField("brand", e.target.value)}
                    />

                    <input
                      className="hg-input"
                      placeholder="SKU"
                      value={productForm.sku}
                      onChange={(e) => updateFormField("sku", e.target.value)}
                    />

                    <select
                      className="hg-select"
                      value={productForm.category}
                      onChange={(e) => updateFormField("category", e.target.value)}
                    >
                      <option value="other">other</option>
                      <option value="home">home</option>
                      <option value="garden">garden</option>
                      <option value="tools">tools</option>
                      <option value="outdoor">outdoor</option>
                      <option value="kitchen">kitchen</option>
                      <option value="storage">storage</option>
                    </select>

                    <input
                      className="hg-input"
                      placeholder="Цена"
                      value={productForm.price}
                      onChange={(e) => updateFormField("price", e.target.value)}
                    />

                    <input
                      className="hg-input"
                      placeholder="Базова цена"
                      value={productForm.basePrice}
                      onChange={(e) => updateFormField("basePrice", e.target.value)}
                    />

                    <select
                      className="hg-select"
                      value={productForm.markupType}
                      onChange={(e) => updateFormField("markupType", e.target.value)}
                    >
                      <option value="none">Без надценка</option>
                      <option value="percent">Процент</option>
                      <option value="fixed">Фиксирана</option>
                    </select>

                    <input
                      className="hg-input"
                      placeholder="Надценка"
                      value={productForm.markupValue}
                      onChange={(e) => updateFormField("markupValue", e.target.value)}
                    />

                    <input
                      className="hg-input"
                      placeholder="Крайна цена"
                      value={productForm.finalPrice}
                      onChange={(e) => updateFormField("finalPrice", e.target.value)}
                    />

                    <input
                      className="hg-input"
                      placeholder="Валута"
                      value={productForm.currency}
                      onChange={(e) => updateFormField("currency", e.target.value)}
                    />

                    <input
                      className="hg-input"
                      placeholder="Доставна цена"
                      value={productForm.shippingPrice}
                      onChange={(e) => updateFormField("shippingPrice", e.target.value)}
                    />

                    <input
                      className="hg-input"
                      placeholder="Дни за доставка"
                      value={productForm.shippingDays}
                      onChange={(e) => updateFormField("shippingDays", e.target.value)}
                    />

                    <select
                      className="hg-select"
                      value={productForm.stockStatus}
                      onChange={(e) => updateFormField("stockStatus", e.target.value)}
                    >
                      <option value="unknown">Неизвестна наличност</option>
                      <option value="in_stock">В наличност</option>
                      <option value="out_of_stock">Изчерпан</option>
                    </select>

                    <input
                      className="hg-input"
                      placeholder="Количество"
                      value={productForm.stockQty}
                      onChange={(e) => updateFormField("stockQty", e.target.value)}
                    />

                    <input
                      className="hg-input"
                      placeholder="Главна снимка (URL)"
                      value={productForm.imageUrl}
                      onChange={(e) => updateFormField("imageUrl", e.target.value)}
                    />

                    <input
                      className="hg-input"
                      placeholder="Source"
                      value={productForm.source}
                      onChange={(e) => updateFormField("source", e.target.value)}
                    />

                    <input
                      className="hg-input"
                      placeholder="Source URL"
                      value={productForm.sourceUrl}
                      onChange={(e) => updateFormField("sourceUrl", e.target.value)}
                    />

                    <select
                      className="hg-select"
                      value={productForm.status}
                      onChange={(e) => updateFormField("status", e.target.value)}
                    >
                      <option value="new">new</option>
                      <option value="approved">approved</option>
                      <option value="rejected">rejected</option>
                      <option value="blacklisted">blacklisted</option>
                    </select>

                    <label className="hg-check">
                      <input
                        type="checkbox"
                        checked={productForm.shippingToBG}
                        onChange={(e) => updateFormField("shippingToBG", e.target.checked)}
                      />
                      Доставка до България
                    </label>

                    <label className="hg-check">
                      <input
                        type="checkbox"
                        checked={productForm.isActive}
                        onChange={(e) => updateFormField("isActive", e.target.checked)}
                      />
                      Активен продукт
                    </label>

                    <label className="hg-check">
                      <input
                        type="checkbox"
                        checked={productForm.isFeatured}
                        onChange={(e) => updateFormField("isFeatured", e.target.checked)}
                      />
                      Препоръчан
                    </label>
                  </div>

                  <textarea
                    className="hg-textarea"
                    placeholder="Кратко описание"
                    value={productForm.shortDescription}
                    onChange={(e) => updateFormField("shortDescription", e.target.value)}
                  />

                  <textarea
                    className="hg-textarea"
                    placeholder="Описание"
                    value={productForm.description}
                    onChange={(e) => updateFormField("description", e.target.value)}
                  />

                  <textarea
                    className="hg-textarea"
                    placeholder="Допълнителни снимки (по един URL на ред)"
                    value={productForm.imagesText}
                    onChange={(e) => updateFormField("imagesText", e.target.value)}
                  />

                  <div className="hg-actions">
                    <button
                      className="hg-btn hg-btn--primary"
                      type="submit"
                      disabled={formLoading}
                    >
                      {formLoading
                        ? "Запис..."
                        : editingId
                        ? "Запази промените"
                        : "Добави продукт"}
                    </button>

                    <button
                      className="hg-btn"
                      type="button"
                      onClick={closeForm}
                      disabled={formLoading}
                    >
                      Отказ
                    </button>
                  </div>
                </form>
              )}

              <div className="hg-grid">
                {!adminLoading && adminItems.length === 0 && (
                  <div className="hg-panel">Няма продукти за този филтър.</div>
                )}

                {adminItems.map((p) => (
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
                        <span className="hg-pill">
                          {p.brand || "без марка"}
                        </span>
                        <span className="hg-pill">
                          {p.stockStatus || "unknown"}
                        </span>
                        <span className="hg-pill hg-pill--status">
                          статус: {p.status}
                        </span>
                      </div>

                      <div className="hg-kpis">
                        Каталог:{" "}
                        <b>
                          {Array.isArray(p.categoryPath) && p.categoryPath.length
                            ? p.categoryPath.join(" / ")
                            : p.category || "-"}
                        </b>
                      </div>

                      <div className="hg-kpis">
                        SKU: <b>{p.sku || "-"}</b> • Наличност:{" "}
                        <b>{p.stockQty ?? "-"}</b>
                      </div>

                      <div className="hg-price">
                        {formatPrice(productPrice(p), p.currency)}
                      </div>

                      <div className="hg-kpis">
                        Преглеждания: <b>{p.views ?? 0}</b> • Кликове:{" "}
                        <b>{p.clicks ?? 0}</b>
                      </div>

                      <div className="hg-actions hg-actions--wrap">
                        <button
                          className="hg-btn hg-btn--primary"
                          onClick={() => openEditForm(p)}
                          disabled={adminLoading}
                        >
                          Редактирай
                        </button>

                        <button
                          className="hg-btn"
                          onClick={() => setStatus(p._id, "approved")}
                          disabled={adminLoading}
                        >
                          Одобри
                        </button>
                        <button
                          className="hg-btn"
                          onClick={() => setStatus(p._id, "rejected")}
                          disabled={adminLoading}
                        >
                          Откажи
                        </button>
                        <button
                          className="hg-btn"
                          onClick={() => setStatus(p._id, "blacklisted")}
                          disabled={adminLoading}
                        >
                          Черен списък
                        </button>
                        <button
                          className="hg-btn hg-btn--danger"
                          onClick={() => deleteProduct(p._id)}
                          disabled={adminLoading}
                        >
                          Изтрий
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* PUBLIC */}
      {view === "public" && (
        <>
          <div className="hg-toolbar">
            <input
              className="hg-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Търси по модел, марка или продукт..."
            />

            <select
              className="hg-select"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {loading && <div className="hg-panel">Зареждане…</div>}
          {!loading && errMsg && (
            <div className="hg-panel hg-panel--bad">{errMsg}</div>
          )}

          {!loading && (
            <div className="hg-pager">
              <button
                className="hg-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Назад
              </button>
              <div className="hg-counter">
                Страница <b>{page}</b> / <b>{totalPages}</b> — Общо:{" "}
                <b>{meta.total}</b>
              </div>
              <button
                className="hg-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Напред
              </button>
            </div>
          )}

          <div className="hg-grid">
            {!loading && products.length === 0 && (
              <div className="hg-panel">Няма продукти.</div>
            )}

            {products.map((p) => (
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

                    {p.stockStatus === "in_stock" ? (
                      <span className="hg-pill hg-pill--ok">В наличност</span>
                    ) : p.stockStatus === "out_of_stock" ? (
                      <span className="hg-pill hg-pill--bad">Изчерпан</span>
                    ) : (
                      <span className="hg-pill">Наличност: неизвестна</span>
                    )}

                    {p.shippingDays ? (
                      <span className="hg-pill">
                        Доставка: {p.shippingDays} дни
                      </span>
                    ) : null}
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
                      Добави в количката
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* PRODUCT MODAL */}
          {selectedProduct ? (
            <>
              <div className="hg-modalBackdrop" onClick={closeProduct} />
              <div className="hg-modal">
                <div className="hg-modalHead">
                  <div className="hg-modalTitle">Детайли за продукта</div>
                  <button
                    className="hg-modalClose"
                    onClick={closeProduct}
                    aria-label="Затвори"
                  >
                    ✕
                  </button>
                </div>

                <div className="hg-productModal">
                  <div
                    className="hg-productModal__image"
                    style={{
                      backgroundImage: productImage(selectedProduct)
                        ? `url("${productImage(selectedProduct)}")`
                        : "linear-gradient(135deg,#eee,#f7f7f7)",
                    }}
                  />

                  <div className="hg-productModal__content">
                    <h2 className="hg-productModal__title">
                      {selectedProduct.title}
                    </h2>

                    <div className="hg-meta">
                      {selectedProduct.brand ? (
                        <span className="hg-pill">{selectedProduct.brand}</span>
                      ) : null}

                      {selectedProduct.sku ? (
                        <span className="hg-pill">SKU: {selectedProduct.sku}</span>
                      ) : null}

                      <span className="hg-pill">
                        {selectedProduct.stockStatus || "unknown"}
                      </span>
                    </div>

                    <div className="hg-price">
                      {formatPrice(
                        productPrice(selectedProduct),
                        selectedProduct.currency
                      )}
                    </div>

                    {selectedProduct.shortDescription ? (
                      <div className="hg-productModal__text">
                        {selectedProduct.shortDescription}
                      </div>
                    ) : null}

                    {selectedProduct.description ? (
                      <div className="hg-productModal__text">
                        {selectedProduct.description}
                      </div>
                    ) : null}

                    <div className="hg-kpis">
                      Наличност: <b>{selectedProduct.stockQty ?? "-"}</b> •
                      Доставка:{" "}
                      <b>
                        {selectedProduct.shippingDays
                          ? `${selectedProduct.shippingDays} дни`
                          : "—"}
                      </b>
                    </div>

                    <div className="hg-actions">
                      <button
                        className="hg-btn hg-btn--primary"
                        onClick={() => addToCart(selectedProduct)}
                      >
                        Добави в количката
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {/* CART DRAWER */}
          {cartOpen ? (
            <>
              <div
                className="hg-modalBackdrop"
                onClick={() => setCartOpen(false)}
              />
              <div className="hg-cartDrawer">
                <div className="hg-modalHead">
                  <div className="hg-modalTitle">Количка</div>
                  <button
                    className="hg-modalClose"
                    onClick={() => setCartOpen(false)}
                    aria-label="Затвори"
                  >
                    ✕
                  </button>
                </div>

                <div className="hg-cartBody">
                  {!cart.length ? (
                    <div className="hg-panel">Количката е празна.</div>
                  ) : (
                    <>
                      <div className="hg-cartList">
                        {cart.map((item) => (
                          <div className="hg-cartItem" key={item._id}>
                            <div
                              className="hg-cartItem__image"
                              style={{
                                backgroundImage: item.imageUrl
                                  ? `url("${item.imageUrl}")`
                                  : "linear-gradient(135deg,#eee,#f7f7f7)",
                              }}
                            />
                            <div className="hg-cartItem__content">
                              <div className="hg-cartItem__title">
                                {item.title}
                              </div>
                              <div className="hg-cartItem__price">
                                {formatPrice(item.price, item.currency)}
                              </div>

                              <div className="hg-cartQty">
                                <button
                                  className="hg-btn"
                                  onClick={() => decreaseQty(item._id)}
                                >
                                  -
                                </button>
                                <span className="hg-cartQty__value">
                                  {item.qty}
                                </span>
                                <button
                                  className="hg-btn"
                                  onClick={() => increaseQty(item._id)}
                                >
                                  +
                                </button>
                                <button
                                  className="hg-btn hg-btn--danger"
                                  onClick={() => removeFromCart(item._id)}
                                >
                                  Премахни
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="hg-cartFooter">
                        <div className="hg-cartTotal">
                          Общо: <b>{formatPrice(cartTotal, "BGN")}</b>
                        </div>

                        <div className="hg-note">
                          Това е първа стъпка: количката вече работи. Следващият
                          етап е backend за поръчки.
                        </div>

                        <div className="hg-actions">
                          <button className="hg-btn" onClick={clearCart}>
                            Изчисти количката
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />} />
      <Route path="*" element={<AppShell />} />
    </Routes>
  );
}