import { useEffect, useMemo, useState } from "react";
import {
  Routes,
  Route,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import "./App.css";

// API base
const API =
  process.env.NODE_ENV === "production"
    ? window.location.origin
    : "http://localhost:8000";

const DEFAULT_SITE_TITLE = "Кафе Маркет";
const DEFAULT_TITLE =
  "Кафе Маркет | Премиум кафе, капсули, кафемашини и аксесоари";
const DEFAULT_DESCRIPTION =
  "Онлайн магазин за премиум кафе продукти, кафемашини, капсули и аксесоари за дома, офиса и професионалната среда.";
const DEFAULT_OG_TYPE = "website";

const ADMIN_STATUSES = ["all", "new", "approved", "rejected", "blacklisted"];

const ADMIN_STATUS_LABELS = {
  all: "Всички",
  new: "Нови",
  approved: "Одобрени",
  rejected: "Отхвърлени",
  blacklisted: "Черен списък",
};

const ADMIN_ORDER_STATUSES = [
  "all",
  "new",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

const ADMIN_ORDER_STATUS_LABELS = {
  all: "Всички поръчки",
  new: "Нови",
  confirmed: "Потвърдени",
  shipped: "Изпратени",
  delivered: "Доставени",
  cancelled: "Отказани",
};

const SORTS = [
  { value: "featured", label: "Препоръчани" },
  { value: "newest", label: "Най-нови" },
  { value: "popular", label: "Най-популярни" },
  { value: "priceAsc", label: "Цена (ниска → висока)" },
  { value: "priceDesc", label: "Цена (висока → ниска)" },
];

const PUBLIC_CATEGORY_CHIPS = [
  { label: "Кафе на зърна", value: "coffee-beans" },
  { label: "Мляно кафе", value: "ground-coffee" },
  { label: "Капсули", value: "capsules" },
  { label: "Кафемашини", value: "machines" },
  { label: "Аксесоари", value: "accessories" },
  { label: "Подаръчни комплекти", value: "gift-sets" },
];

const HERO_LINKS = [
  { label: "Кафе на зърна", category: "coffee-beans", icon: "☕" },
  { label: "Капсули и дози", category: "capsules", icon: "◉" },
  { label: "Кафемашини", category: "machines", icon: "▣" },
  { label: "Аксесоари", category: "accessories", icon: "✦" },
  { label: "Подаръчни комплекти", category: "gift-sets", icon: "🎁" },
];

const ADMIN_CATEGORY_OPTIONS = [
  { value: "coffee-beans", label: "Кафе на зърна" },
  { value: "ground-coffee", label: "Мляно кафе" },
  { value: "capsules", label: "Капсули" },
  { value: "pods", label: "Дози и Pods" },
  { value: "machines", label: "Кафемашини" },
  { value: "grinders", label: "Мелачки" },
  { value: "accessories", label: "Аксесоари" },
  { value: "cups", label: "Чаши и термоси" },
  { value: "syrups", label: "Сиропи" },
  { value: "gift-sets", label: "Подаръчни комплекти" },
  { value: "office-coffee", label: "Офис кафе" },
  { value: "horeca", label: "HoReCa" },
  { value: "other", label: "Друго" },
];

const ROAST_OPTIONS = [
  { value: "", label: "Без избор" },
  { value: "light", label: "Светло изпечено" },
  { value: "medium", label: "Средно изпечено" },
  { value: "medium-dark", label: "Средно тъмно" },
  { value: "dark", label: "Тъмно изпечено" },
];

const CAFFEINE_OPTIONS = [
  { value: "", label: "Без избор" },
  { value: "regular", label: "С кофеин" },
  { value: "decaf", label: "Без кофеин" },
];

const WEIGHT_UNIT_OPTIONS = [
  { value: "", label: "Без единица" },
  { value: "g", label: "г" },
  { value: "kg", label: "кг" },
  { value: "ml", label: "мл" },
  { value: "l", label: "л" },
  { value: "pcs", label: "бр." },
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

function normalizeImageUrl(value) {
  if (!value) return "";

  if (typeof value === "string") {
    const clean = value.trim();
    return clean || "";
  }

  if (typeof value === "object") {
    const candidates = [
      value.url,
      value.src,
      value.secure_url,
      value.imageUrl,
      value.path,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return "";
}

function productImages(p) {
  const images = [];
  const seen = new Set();

  const pushImage = (value) => {
    const clean = normalizeImageUrl(value);
    if (!clean) return;
    if (seen.has(clean)) return;
    seen.add(clean);
    images.push(clean);
  };

  pushImage(p?.imageUrl);

  if (Array.isArray(p?.images)) {
    p.images.forEach((img) => pushImage(img));
  }

  return images;
}

function productImage(p) {
  const images = productImages(p);
  return images[0] || "";
}

function productRouteValue(product) {
  return product?.slug || product?._id || "";
}

function cartStorageKey() {
  return "coffee_shop_cart_v1";
}

function stringToLines(value) {
  if (Array.isArray(value)) return value.join("\n");
  return "";
}

function linesToArray(value) {
  return String(value || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function emptyProductForm() {
  return {
    title: "",
    shortDescription: "",
    description: "",
    brand: "",
    sku: "",
    category: "coffee-beans",
    source: "manual",
    sourceUrl: "",
    imageUrl: "",
    imagesText: "",
    price: "",
    basePrice: "",
    oldPrice: "",
    markupType: "none",
    markupValue: "",
    finalPrice: "",
    currency: "BGN",
    shippingPrice: "0",
    shippingToBG: true,
    shippingDays: "",
    stockStatus: "in_stock",
    stockQty: "",
    weight: "",
    weightUnit: "",
    packCount: "",
    roastLevel: "",
    intensity: "",
    caffeineType: "",
    compatibleWithText: "",
    badgesText: "",
    rating: "",
    reviewsCount: "",
    isNew: false,
    isOnSale: false,
    isActive: true,
    isFeatured: false,
    status: "new",
  };
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("bg-BG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ensureMetaTag(attr, value) {
  if (typeof document === "undefined") return null;
  let tag = document.head.querySelector(`meta[${attr}="${value}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, value);
    document.head.appendChild(tag);
  }
  return tag;
}

function setMetaContent(attr, value, content) {
  const tag = ensureMetaTag(attr, value);
  if (tag) tag.setAttribute("content", content || "");
}

function removeMetaTag(attr, value) {
  if (typeof document === "undefined") return;
  const tag = document.head.querySelector(`meta[${attr}="${value}"]`);
  if (tag) tag.remove();
}

function ensureCanonical() {
  if (typeof document === "undefined") return null;
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  return link;
}

function setCanonical(href) {
  const link = ensureCanonical();
  if (link) link.setAttribute("href", href || "");
}

function setStructuredDataById(id, data) {
  if (typeof document === "undefined") return;
  let script = document.getElementById(id);
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = id;
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

function removeStructuredDataById(id) {
  if (typeof document === "undefined") return;
  const script = document.getElementById(id);
  if (script) script.remove();
}

function categoryLabelFromValue(value) {
  const found = ADMIN_CATEGORY_OPTIONS.find((x) => x.value === value);
  return found?.label || value || "";
}

function buildProductTitle(product) {
  const parts = [product?.title, product?.brand, DEFAULT_SITE_TITLE].filter(Boolean);
  return parts.join(" | ");
}

function buildProductDescription(product) {
  const firstText =
    String(product?.shortDescription || product?.description || "")
      .replace(/\s+/g, " ")
      .trim() || "";
  const categoryLabel = categoryLabelFromValue(product?.category);
  const priceText = Number.isFinite(Number(productPrice(product)))
    ? `Цена: ${formatPrice(productPrice(product), product?.currency || "BGN")}.`
    : "";
  const stockText =
    product?.stockStatus === "in_stock"
      ? "В наличност."
      : product?.stockStatus === "out_of_stock"
      ? "Временно изчерпан."
      : "";
  const composed = [categoryLabel, firstText, priceText, stockText]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!composed) return DEFAULT_DESCRIPTION;
  return composed.slice(0, 155);
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />} />
      <Route path="/products/:slug" element={<AppShell />} />
      <Route path="/admin" element={<AppShell />} />
      <Route path="*" element={<AppShell />} />
    </Routes>
  );
}

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { slug: productSlug } = useParams();

  const isAdminRoute = location.pathname.startsWith("/admin");
  const isProductPage = location.pathname.startsWith("/products/");
  const isPublicRoute = !isAdminRoute;

  /* =========================
     AUTH / ADMIN
  ========================== */
  const [view, setView] = useState(isAdminRoute ? "admin" : "public");
  const [adminSection, setAdminSection] = useState("products");

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

  /* =========================
     PUBLIC PRODUCTS
  ========================== */
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sort, setSort] = useState("featured");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  const [productPage, setProductPage] = useState(null);
  const [productPageLoading, setProductPageLoading] = useState(false);
  const [productPageMsg, setProductPageMsg] = useState("");
  const [productGalleryIndex, setProductGalleryIndex] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  /* =========================
     ADMIN IMAGE UPLOAD
  ========================== */
  const [mainImageUploading, setMainImageUploading] = useState(false);
  const [mainImageUploadMsg, setMainImageUploadMsg] = useState("");
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryUploadMsg, setGalleryUploadMsg] = useState("");

  useEffect(() => {
    const nextView = location.pathname.startsWith("/admin") ? "admin" : "public";
    setView(nextView);
  }, [location.pathname]);

  function goPublic() {
    setView("public");
    navigate("/");
  }

  function goAdmin() {
    setView("admin");
    navigate("/admin");
  }

  async function apiFetch(path, opts = {}) {
    const hasBody = opts.body != null;
    const isFormData =
      typeof FormData !== "undefined" && opts.body instanceof FormData;

    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: {
        ...(!isFormData && hasBody ? { "Content-Type": "application/json" } : {}),
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
      const parts = [
        data?.message,
        data?.error,
        data?.details ? JSON.stringify(data.details) : "",
      ].filter(Boolean);

      const msg =
        parts.join(" | ") ||
        (text?.includes("<!doctype") || text?.includes("<html")
          ? "Сървърът върна HTML вместо JSON."
          : text || `HTTP ${res.status}`);

      throw new Error(msg);
    }

    return data;
  }

  async function uploadSingleImageFile(file) {
    if (!file) throw new Error("Няма избран файл");

    const formData = new FormData();
    formData.append("image", file);

    const data = await apiFetch("/admin/upload-image", {
      method: "POST",
      body: formData,
    });

    const url = normalizeImageUrl(data?.url || data?.secure_url);
    if (!url) {
      throw new Error("Не е върнат URL на снимката");
    }

    return url;
  }

  async function handleMainImageUpload(file) {
    if (!file) return;

    setMainImageUploading(true);
    setMainImageUploadMsg("");

    try {
      const url = await uploadSingleImageFile(file);
      updateFormField("imageUrl", url);
      setMainImageUploadMsg("Главната снимка е качена успешно.");
    } catch (e) {
      setMainImageUploadMsg(e?.message || "Грешка при качване на главната снимка.");
    } finally {
      setMainImageUploading(false);
    }
  }

  async function handleGalleryImagesUpload(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    setGalleryUploading(true);
    setGalleryUploadMsg("");

    try {
      const uploadedUrls = [];
      for (const file of files) {
        const url = await uploadSingleImageFile(file);
        if (url) uploadedUrls.push(url);
      }

      if (!uploadedUrls.length) {
        throw new Error("Не бяха качени снимки");
      }

      const current = linesToArray(productForm.imagesText);
      const merged = [...current];

      uploadedUrls.forEach((url) => {
        if (!merged.includes(url)) {
          merged.push(url);
        }
      });

      updateFormField("imagesText", merged.join("\n"));
      setGalleryUploadMsg(
        uploadedUrls.length === 1
          ? "Допълнителната снимка е качена успешно."
          : `Качени са ${uploadedUrls.length} допълнителни снимки.`
      );
    } catch (e) {
      setGalleryUploadMsg(
        e?.message || "Грешка при качване на допълнителните снимки."
      );
    } finally {
      setGalleryUploading(false);
    }
  }

  useEffect(() => {
    if (typeof document === "undefined") return;

    const origin = window.location.origin;
    const cleanPath = location.pathname;
    const currentUrl = `${origin}${cleanPath}`;

    if (isProductPage && productPage) {
      const title = buildProductTitle(productPage);
      const description = buildProductDescription(productPage);
      const image = productImage(productPage) || "";
      const price = productPrice(productPage);
      const availability =
        productPage?.stockStatus === "in_stock"
          ? "https://schema.org/InStock"
          : productPage?.stockStatus === "out_of_stock"
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/LimitedAvailability";

      document.title = title;
      setMetaContent("name", "description", description);
      setCanonical(currentUrl);

      setMetaContent("property", "og:type", "product");
      setMetaContent("property", "og:title", title);
      setMetaContent("property", "og:description", description);
      setMetaContent("property", "og:url", currentUrl);

      if (image) {
        setMetaContent("property", "og:image", image);
        setMetaContent("name", "twitter:image", image);
      } else {
        removeMetaTag("property", "og:image");
        removeMetaTag("name", "twitter:image");
      }

      setMetaContent(
        "name",
        "twitter:card",
        image ? "summary_large_image" : "summary"
      );
      setMetaContent("name", "twitter:title", title);
      setMetaContent("name", "twitter:description", description);

      setStructuredDataById("hg-jsonld-product", {
        "@context": "https://schema.org",
        "@type": "Product",
        name: productPage?.title || "",
        image: productImages(productPage),
        description,
        sku: productPage?.sku || undefined,
        brand: productPage?.brand
          ? {
              "@type": "Brand",
              name: productPage.brand,
            }
          : undefined,
        category: categoryLabelFromValue(productPage?.category) || undefined,
        offers: {
          "@type": "Offer",
          url: currentUrl,
          priceCurrency: productPage?.currency || "BGN",
          price:
            Number.isFinite(Number(price)) && Number(price) >= 0
              ? Number(price).toFixed(2)
              : undefined,
          availability,
          itemCondition: "https://schema.org/NewCondition",
        },
      });

      setStructuredDataById("hg-jsonld-breadcrumbs", {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Начало",
            item: `${origin}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: categoryLabelFromValue(productPage?.category) || "Продукти",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: productPage?.title || "Продукт",
            item: currentUrl,
          },
        ],
      });

      return;
    }

    const defaultPublicUrl = `${origin}${
      location.pathname === "/admin" ? "/" : location.pathname
    }`;

    document.title = DEFAULT_TITLE;
    setMetaContent("name", "description", DEFAULT_DESCRIPTION);
    setCanonical(defaultPublicUrl);
    setMetaContent("property", "og:type", DEFAULT_OG_TYPE);
    setMetaContent("property", "og:title", DEFAULT_TITLE);
    setMetaContent("property", "og:description", DEFAULT_DESCRIPTION);
    setMetaContent("property", "og:url", defaultPublicUrl);
    setMetaContent("name", "twitter:card", "summary_large_image");
    setMetaContent("name", "twitter:title", DEFAULT_TITLE);
    setMetaContent("name", "twitter:description", DEFAULT_DESCRIPTION);
    removeMetaTag("property", "og:image");
    removeMetaTag("name", "twitter:image");
    removeStructuredDataById("hg-jsonld-product");
    removeStructuredDataById("hg-jsonld-breadcrumbs");
  }, [isProductPage, productPage, location.pathname]);

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
        goPublic();
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
      setAdminSection("products");
      setAuthMsg("Успешен вход");
      navigate("/admin");
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
    setAdminSection("products");
    try {
      localStorage.removeItem("token");
    } catch {}
    navigate("/");
  }

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [qDebounced, sort, selectedCategory]);

  useEffect(() => {
    let aborted = false;

    async function loadProducts() {
      if (view !== "public") return;
      if (isProductPage) return;

      setLoading(true);
      setErrMsg("");

      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        params.set("sort", sort);
        if (qDebounced) params.set("q", qDebounced);
        if (selectedCategory && selectedCategory !== "all") {
          params.set("category", selectedCategory);
        }

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
  }, [view, qDebounced, selectedCategory, sort, page, limit, isProductPage]);

  useEffect(() => {
    let aborted = false;

    async function loadProductPage() {
      if (!isPublicRoute) return;

      if (!isProductPage || !productSlug) {
        setProductPage(null);
        setProductPageMsg("");
        setProductPageLoading(false);
        return;
      }

      setProductPageLoading(true);
      setProductPageMsg("");
      setProductGalleryIndex(0);

      try {
        const data = await apiFetch(`/products/${productSlug}`, {
          method: "GET",
        });

        if (aborted) return;

        if (data?.canonicalPath && data.canonicalPath !== location.pathname) {
          navigate(data.canonicalPath, { replace: true });
        }

        const product = data?.item || data?.product || data || null;
        setProductPage(product);

        try {
          await fetch(`${API}/products/${productSlug}/view`, {
            method: "POST",
          });
        } catch {}
      } catch (e) {
        if (!aborted) {
          setProductPage(null);
          setProductPageMsg(e?.message || "Грешка при зареждане на продукта.");
        }
      } finally {
        if (!aborted) setProductPageLoading(false);
      }
    }

    loadProductPage();
    return () => {
      aborted = true;
    };
  }, [isPublicRoute, isProductPage, productSlug, location.pathname, navigate]);

  useEffect(() => {
    let aborted = false;

    async function loadRelatedProducts() {
      if (!productPage?._id || !productPage?.category) {
        setRelatedProducts([]);
        setRelatedLoading(false);
        return;
      }

      setRelatedLoading(true);

      try {
        const params = new URLSearchParams();
        params.set("category", productPage.category);
        params.set("limit", "4");
        params.set("sort", "featured");

        const data = await apiFetch(`/products?${params.toString()}`, {
          method: "GET",
        });

        if (aborted) return;

        const items = Array.isArray(data?.items) ? data.items : [];
        setRelatedProducts(
          items.filter((item) => item?._id !== productPage._id).slice(0, 4)
        );
      } catch {
        if (!aborted) setRelatedProducts([]);
      } finally {
        if (!aborted) setRelatedLoading(false);
      }
    }

    loadRelatedProducts();
    return () => {
      aborted = true;
    };
  }, [productPage]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || 20)));
  }, [meta]);

  const activeProductImages = useMemo(() => {
    return productImages(productPage);
  }, [productPage]);

  const activeProductImage =
    activeProductImages[productGalleryIndex] || productImage(productPage);

  /* =========================
     PRODUCT MODAL / PAGE NAV
  ========================== */
  const [selectedProduct, setSelectedProduct] = useState(null);

  async function openProduct(product) {
    const target = productRouteValue(product);
    if (!target) return;
    navigate(`/products/${target}`);
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

  const [checkoutForm, setCheckoutForm] = useState({
    customerName: "",
    phone: "",
    city: "",
    address: "",
    note: "",
  });

  const [orderLoading, setOrderLoading] = useState(false);
  const [orderMsg, setOrderMsg] = useState("");

  function updateCheckoutField(key, value) {
    setCheckoutForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function submitOrder(e) {
    e?.preventDefault?.();
    setOrderMsg("");

    if (!cart.length) {
      setOrderMsg("Количката е празна.");
      return;
    }

    if (!checkoutForm.customerName.trim() || !checkoutForm.phone.trim()) {
      setOrderMsg("Името и телефонът са задължителни.");
      return;
    }

    setOrderLoading(true);

    try {
      const payload = {
        customerName: checkoutForm.customerName.trim(),
        phone: checkoutForm.phone.trim(),
        city: checkoutForm.city.trim(),
        address: checkoutForm.address.trim(),
        note: checkoutForm.note.trim(),
        items: cart.map((item) => ({
          productId: item._id,
          qty: item.qty,
        })),
      };

      const data = await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setOrderMsg(data?.message || "Поръчката е изпратена успешно.");
      clearCart();

      setCheckoutForm({
        customerName: "",
        phone: "",
        city: "",
        address: "",
        note: "",
      });
    } catch (e2) {
      setOrderMsg(e2?.message || "Грешка при изпращане на поръчката.");
    } finally {
      setOrderLoading(false);
    }
  }

  /* =========================
     ADMIN PRODUCTS
  ========================== */
  const [adminStatus, setAdminStatus] = useState("new");
  const [adminItems, setAdminItems] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMsg, setAdminMsg] = useState("");
  const [selectedAdminIds, setSelectedAdminIds] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [productForm, setProductForm] = useState(emptyProductForm());
  const [formLoading, setFormLoading] = useState(false);

  const selectedCount = selectedAdminIds.length;

  const allVisibleSelected =
    adminItems.length > 0 &&
    adminItems.every((item) => selectedAdminIds.includes(item._id));

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

      const items = Array.isArray(data?.items) ? data.items : [];
      setAdminItems(items);
      setSelectedAdminIds((prev) =>
        prev.filter((id) => items.some((item) => item._id === id))
      );
    } catch (e) {
      setAdminMsg(e?.message || "Грешка при зареждане");
      setAdminItems([]);
      setSelectedAdminIds([]);
    } finally {
      setAdminLoading(false);
    }
  }

  useEffect(() => {
    if (view !== "admin") return;
    if (!token) return;
    if (meLoading) return;
    if (!isAdmin) return;
    if (adminSection !== "products") return;

    loadAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, token, meLoading, isAdmin, adminStatus, adminSection]);

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

  async function setSingleFeatured(id, isFeatured) {
    setAdminMsg("");
    try {
      const r = await apiFetch(`/admin/products/feature-many`, {
        method: "PATCH",
        body: JSON.stringify({
          ids: [id],
          isFeatured,
        }),
      });

      setAdminMsg(
        isFeatured
          ? `Продуктът е маркиран като препоръчан. Обновени: ${r?.modified ?? 0}`
          : `Продуктът е премахнат от препоръчани. Обновени: ${r?.modified ?? 0}`
      );

      await loadAdmin();
    } catch (e) {
      setAdminMsg(e?.message || "Грешка при промяна на препоръчан продукт");
    }
  }

  async function deleteProduct(id) {
    if (!window.confirm("Сигурен ли си, че искаш да изтриеш този продукт?")) {
      return;
    }

    setAdminMsg("");
    try {
      await apiFetch(`/admin/products/${id}`, { method: "DELETE" });
      setSelectedAdminIds((prev) => prev.filter((x) => x !== id));
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
    setFormLoading(false);
    setAdminMsg("");
    setMainImageUploadMsg("");
    setGalleryUploadMsg("");
  }

  function openEditForm(product) {
    setEditingId(product?._id || "");
    setProductForm({
      title: product?.title || "",
      shortDescription: product?.shortDescription || "",
      description: product?.description || "",
      brand: product?.brand || "",
      sku: product?.sku || "",
      category: product?.category || "coffee-beans",
      source: product?.source || "manual",
      sourceUrl: product?.sourceUrl || "",
      imageUrl: product?.imageUrl || "",
      imagesText: Array.isArray(product?.images) ? product.images.join("\n") : "",
      price: product?.price ?? "",
      basePrice: product?.basePrice ?? "",
      oldPrice: product?.oldPrice ?? "",
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
      weight: product?.weight ?? "",
      weightUnit: product?.weightUnit || "",
      packCount: product?.packCount ?? "",
      roastLevel: product?.roastLevel || "",
      intensity: product?.intensity ?? "",
      caffeineType: product?.caffeineType || "",
      compatibleWithText: stringToLines(product?.compatibleWith),
      badgesText: stringToLines(product?.badges),
      rating: product?.rating ?? "",
      reviewsCount: product?.reviewsCount ?? "",
      isNew: typeof product?.isNew === "boolean" ? product.isNew : false,
      isOnSale:
        typeof product?.isOnSale === "boolean" ? product.isOnSale : false,
      isActive:
        typeof product?.isActive === "boolean" ? product.isActive : true,
      isFeatured:
        typeof product?.isFeatured === "boolean" ? product.isFeatured : false,
      status: product?.status || "new",
    });
    setFormOpen(true);
    setFormLoading(false);
    setAdminMsg("");
    setMainImageUploadMsg("");
    setGalleryUploadMsg("");
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId("");
    setProductForm(emptyProductForm());
    setFormLoading(false);
    setMainImageUploadMsg("");
    setGalleryUploadMsg("");
  }

  function updateFormField(key, value) {
    setProductForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function toggleAdminSelection(id) {
    setSelectedAdminIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAllVisible() {
    if (!adminItems.length) return;

    if (allVisibleSelected) {
      setSelectedAdminIds((prev) =>
        prev.filter((id) => !adminItems.some((item) => item._id === id))
      );
      return;
    }

    setSelectedAdminIds((prev) => {
      const set = new Set(prev);
      adminItems.forEach((item) => set.add(item._id));
      return Array.from(set);
    });
  }

  function clearSelectedAdminItems() {
    setSelectedAdminIds([]);
  }

  async function bulkSetFeatured(isFeatured) {
    if (!selectedAdminIds.length) {
      setAdminMsg("Няма избрани продукти.");
      return;
    }

    setAdminMsg("");

    try {
      const r = await apiFetch("/admin/products/feature-many", {
        method: "PATCH",
        body: JSON.stringify({
          ids: selectedAdminIds,
          isFeatured,
        }),
      });

      setAdminMsg(
        isFeatured
          ? `Маркирани като препоръчани: ${r?.modified ?? 0}`
          : `Премахнати от препоръчани: ${r?.modified ?? 0}`
      );
      await loadAdmin();
    } catch (e) {
      setAdminMsg(e?.message || "Грешка при масово маркиране");
    }
  }

  async function bulkDeleteSelected() {
    if (!selectedAdminIds.length) {
      setAdminMsg("Няма избрани продукти.");
      return;
    }

    const confirmText =
      selectedAdminIds.length === 1
        ? "Сигурен ли си, че искаш да изтриеш избрания продукт?"
        : `Сигурен ли си, че искаш да изтриеш ${selectedAdminIds.length} продукта?`;

    if (!window.confirm(confirmText)) {
      return;
    }

    setAdminMsg("");

    try {
      const r = await apiFetch("/admin/products/delete-many", {
        method: "DELETE",
        body: JSON.stringify({
          ids: selectedAdminIds,
        }),
      });

      setAdminMsg(`Изтрити продукти: ${r?.deleted ?? 0}`);
      setSelectedAdminIds([]);
      await loadAdmin();
    } catch (e) {
      setAdminMsg(e?.message || "Грешка при масово изтриване");
    }
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
        category: String(productForm.category || "coffee-beans").trim(),
        source: String(productForm.source || "manual").trim(),
        sourceUrl: String(productForm.sourceUrl || "").trim(),
        imageUrl: String(productForm.imageUrl || "").trim(),
        images,

        price: productForm.price === "" ? null : toNum(productForm.price),
        basePrice:
          productForm.basePrice === "" ? null : toNum(productForm.basePrice),
        oldPrice:
          productForm.oldPrice === "" ? null : toNum(productForm.oldPrice),
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

        weight: productForm.weight === "" ? null : toNum(productForm.weight),
        weightUnit: String(productForm.weightUnit || "").trim(),
        packCount:
          productForm.packCount === "" ? null : toNum(productForm.packCount),
        roastLevel: String(productForm.roastLevel || "").trim(),
        intensity:
          productForm.intensity === "" ? null : toNum(productForm.intensity),
        caffeineType: String(productForm.caffeineType || "").trim(),
        compatibleWith: linesToArray(productForm.compatibleWithText),
        badges: linesToArray(productForm.badgesText),

        rating: productForm.rating === "" ? 0 : toNum(productForm.rating),
        reviewsCount:
          productForm.reviewsCount === "" ? 0 : toNum(productForm.reviewsCount),

        isNew: !!productForm.isNew,
        isOnSale: !!productForm.isOnSale,
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
     ADMIN ORDERS
  ========================== */
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [adminOrders, setAdminOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersMsg, setOrdersMsg] = useState("");

  async function loadAdminOrders() {
    if (!token) {
      setOrdersMsg("Няма токен. Влез първо.");
      return;
    }
    if (!isAdmin) {
      setOrdersMsg("Нямаш админ права.");
      return;
    }

    setOrdersLoading(true);
    setOrdersMsg("");

    try {
      const qs = new URLSearchParams();
      if (orderStatusFilter && orderStatusFilter !== "all") {
        qs.set("status", orderStatusFilter);
      }

      const data = await apiFetch(
        `/orders/admin${qs.toString() ? `?${qs.toString()}` : ""}`,
        {
          method: "GET",
        }
      );

      setAdminOrders(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setOrdersMsg(e?.message || "Грешка при зареждане на поръчките.");
      setAdminOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }

  useEffect(() => {
    if (view !== "admin") return;
    if (!token) return;
    if (meLoading) return;
    if (!isAdmin) return;
    if (adminSection !== "orders") return;

    loadAdminOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, token, meLoading, isAdmin, adminSection, orderStatusFilter]);

  async function updateOrderStatus(orderId, status) {
    setOrdersMsg("");

    try {
      await apiFetch(`/orders/admin/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadAdminOrders();
    } catch (e) {
      setOrdersMsg(e?.message || "Грешка при промяна на статуса на поръчката.");
    }
  }

  function applyQuickSearch(value) {
    setQ(value);
    setSelectedCategory("all");
    setPage(1);
    navigate("/");
  }

  function applyCategoryFilter(categoryValue) {
    setSelectedCategory(categoryValue || "all");
    setQ("");
    setPage(1);
    navigate("/");
  }

  function clearPublicFilters() {
    setQ("");
    setSelectedCategory("all");
    setPage(1);
    navigate("/");
  }

  return (
    <div className={`hg ${view === "public" ? "hg--public" : "hg--admin"}`}>
      {view === "public" ? (
        <header className="hg-publicHeader">
          <div className="hg-publicUtility">
            <div className="hg-publicUtility__brand">
              <button
                className="hg-publicUtility__logoBtn"
                onClick={clearPublicFilters}
                type="button"
              >
                <span className="hg-publicUtility__logo">Кафе Маркет</span>
              </button>

              <div className="hg-publicUtility__copy">
                Премиум кафе продукти, кафемашини, капсули и аксесоари за дома,
                офиса и професионалната среда.
              </div>
            </div>

            <div className="hg-publicUtility__info">
              <span>☎ 02 812 99 99</span>
              <span>Доставка в България</span>
              <span>Онлайн поръчки</span>
            </div>
          </div>

          <div className="hg-publicNav">
            <div className="hg-publicNav__menu">
              <button className="hg-navLink" onClick={clearPublicFilters}>
                Начало
              </button>
              <button
                className="hg-navLink"
                onClick={() => applyCategoryFilter("coffee-beans")}
              >
                Кафе
              </button>
              <button
                className="hg-navLink"
                onClick={() => applyCategoryFilter("capsules")}
              >
                Капсули
              </button>
              <button
                className="hg-navLink"
                onClick={() => applyCategoryFilter("machines")}
              >
                Машини
              </button>
              <button
                className="hg-navLink"
                onClick={() => applyCategoryFilter("accessories")}
              >
                Аксесоари
              </button>
              <button
                className="hg-navLink"
                onClick={() => applyCategoryFilter("gift-sets")}
              >
                Подаръчни комплекти
              </button>
            </div>

            <div className="hg-publicNav__actions">
              <button
                className="hg-btn hg-btn--primary"
                onClick={() => setCartOpen(true)}
              >
                Количка ({cartCount})
              </button>
            </div>
          </div>
        </header>
      ) : (
        <div className="hg-topbar">
          <div className="hg-brand">
            <div>
              <h1 className="hg-title">Кафе Маркет Админ</h1>
              <div className="hg-sub">Админ панел за управление на магазина</div>
            </div>
          </div>

          <div className="hg-topActions">
            <div className="hg-switch">
              <button
                className={`hg-switchBtn ${view === "public" ? "is-active" : ""}`}
                onClick={goPublic}
                disabled={view === "public"}
              >
                Магазин
              </button>

              <button
                className={`hg-switchBtn ${view === "admin" ? "is-active" : ""}`}
                onClick={goAdmin}
                disabled={view === "admin"}
              >
                Админ
              </button>
            </div>

            {token ? (
              <>
                <div className="hg-userChip">
                  роля:{" "}
                  <b>{me?.role || (meLoading ? "проверка..." : "неизвестна")}</b>
                </div>
                <button className="hg-btn" onClick={doLogout}>
                  Изход
                </button>
              </>
            ) : (
              <button className="hg-btn" onClick={goPublic}>
                Към магазина
              </button>
            )}
          </div>
        </div>
      )}

      {view === "admin" && !token && (
        <form className="hg-panel" onSubmit={doLogin}>
          <div className="hg-panelTitle">Админ вход</div>

          <div className="hg-loginGrid">
            <input
              className="hg-input"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="Имейл"
              autoComplete="email"
            />
            <input
              className="hg-input"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              placeholder="Парола"
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

      {view === "admin" && (
        <div>
          {!token ? (
            <div className="hg-panel hg-panel--bad">Влез първо.</div>
          ) : meLoading ? null : !isAdmin ? (
            <div className="hg-panel hg-panel--bad">Нямаш админ права.</div>
          ) : (
            <>
              <div className="hg-toolbar">
                <button
                  className={`hg-btn ${
                    adminSection === "products" ? "hg-btn--primary" : ""
                  }`}
                  onClick={() => setAdminSection("products")}
                >
                  Продукти
                </button>

                <button
                  className={`hg-btn ${
                    adminSection === "orders" ? "hg-btn--primary" : ""
                  }`}
                  onClick={() => setAdminSection("orders")}
                >
                  Поръчки
                </button>

                <button className="hg-btn" onClick={doLogout}>
                  Изход
                </button>
              </div>

              {adminSection === "products" && (
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
                      className="hg-btn"
                      onClick={toggleSelectAllVisible}
                      disabled={adminLoading || adminItems.length === 0}
                    >
                      {allVisibleSelected ? "Размаркирай всички" : "Маркирай всички"}
                    </button>

                    <button
                      className="hg-btn"
                      onClick={() => bulkSetFeatured(true)}
                      disabled={adminLoading || selectedCount === 0}
                    >
                      Избраните → препоръчани
                    </button>

                    <button
                      className="hg-btn"
                      onClick={() => bulkSetFeatured(false)}
                      disabled={adminLoading || selectedCount === 0}
                    >
                      Махни от препоръчани
                    </button>

                    <button
                      className="hg-btn hg-btn--danger"
                      onClick={bulkDeleteSelected}
                      disabled={adminLoading || selectedCount === 0}
                    >
                      Изтрий избраните
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

                    <div className="hg-counter">
                      Избрани: <b>{selectedCount}</b>
                    </div>

                    {selectedCount > 0 ? (
                      <button className="hg-btn" onClick={clearSelectedAdminItems}>
                        Изчисти избора
                      </button>
                    ) : null}
                  </div>

                  {adminMsg && <div className="hg-panel">{adminMsg}</div>}
                  {adminLoading && <div className="hg-panel">Зареждане…</div>}

                  {formOpen && (
                    <form
                      className="hg-panel hg-productForm"
                      onSubmit={submitProductForm}
                    >
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
                          {ADMIN_CATEGORY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
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

                        <input
                          className="hg-input"
                          placeholder="Стара цена"
                          value={productForm.oldPrice}
                          onChange={(e) => updateFormField("oldPrice", e.target.value)}
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
                          placeholder="Цена за доставка"
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
                          placeholder="Грамаж / количество"
                          value={productForm.weight}
                          onChange={(e) => updateFormField("weight", e.target.value)}
                        />

                        <select
                          className="hg-select"
                          value={productForm.weightUnit}
                          onChange={(e) => updateFormField("weightUnit", e.target.value)}
                        >
                          {WEIGHT_UNIT_OPTIONS.map((option) => (
                            <option key={option.value || "empty"} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        <input
                          className="hg-input"
                          placeholder="Брой в опаковка"
                          value={productForm.packCount}
                          onChange={(e) => updateFormField("packCount", e.target.value)}
                        />

                        <select
                          className="hg-select"
                          value={productForm.roastLevel}
                          onChange={(e) => updateFormField("roastLevel", e.target.value)}
                        >
                          {ROAST_OPTIONS.map((option) => (
                            <option key={option.value || "empty"} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        <input
                          className="hg-input"
                          placeholder="Интензитет"
                          value={productForm.intensity}
                          onChange={(e) => updateFormField("intensity", e.target.value)}
                        />

                        <select
                          className="hg-select"
                          value={productForm.caffeineType}
                          onChange={(e) =>
                            updateFormField("caffeineType", e.target.value)
                          }
                        >
                          {CAFFEINE_OPTIONS.map((option) => (
                            <option key={option.value || "empty"} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        <input
                          className="hg-input"
                          placeholder="Рейтинг"
                          value={productForm.rating}
                          onChange={(e) => updateFormField("rating", e.target.value)}
                        />

                        <input
                          className="hg-input"
                          placeholder="Брой ревюта"
                          value={productForm.reviewsCount}
                          onChange={(e) =>
                            updateFormField("reviewsCount", e.target.value)
                          }
                        />

                        <input
                          className="hg-input"
                          placeholder="Главна снимка (URL)"
                          value={productForm.imageUrl}
                          onChange={(e) => updateFormField("imageUrl", e.target.value)}
                        />

                        <input
                          className="hg-input"
                          placeholder="Източник"
                          value={productForm.source}
                          onChange={(e) => updateFormField("source", e.target.value)}
                        />

                        <input
                          className="hg-input"
                          placeholder="URL на източника"
                          value={productForm.sourceUrl}
                          onChange={(e) =>
                            updateFormField("sourceUrl", e.target.value)
                          }
                        />

                        <select
                          className="hg-select"
                          value={productForm.status}
                          onChange={(e) => updateFormField("status", e.target.value)}
                        >
                          <option value="new">Нова</option>
                          <option value="approved">Одобрена</option>
                          <option value="rejected">Отхвърлена</option>
                          <option value="blacklisted">Черен списък</option>
                        </select>

                        <label className="hg-check">
                          <input
                            type="checkbox"
                            checked={productForm.shippingToBG}
                            onChange={(e) =>
                              updateFormField("shippingToBG", e.target.checked)
                            }
                          />
                          Доставка до България
                        </label>

                        <label className="hg-check">
                          <input
                            type="checkbox"
                            checked={productForm.isNew}
                            onChange={(e) => updateFormField("isNew", e.target.checked)}
                          />
                          Нов продукт
                        </label>

                        <label className="hg-check">
                          <input
                            type="checkbox"
                            checked={productForm.isOnSale}
                            onChange={(e) =>
                              updateFormField("isOnSale", e.target.checked)
                            }
                          />
                          В промоция
                        </label>

                        <label className="hg-check">
                          <input
                            type="checkbox"
                            checked={productForm.isActive}
                            onChange={(e) =>
                              updateFormField("isActive", e.target.checked)
                            }
                          />
                          Активен продукт
                        </label>

                        <label className="hg-check">
                          <input
                            type="checkbox"
                            checked={productForm.isFeatured}
                            onChange={(e) =>
                              updateFormField("isFeatured", e.target.checked)
                            }
                          />
                          Препоръчан
                        </label>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: 14,
                          marginBottom: 14,
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gap: 10,
                            padding: 14,
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,.14)",
                            background: "rgba(255,255,255,.04)",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: 14,
                            }}
                          >
                            Качи главна снимка от компютъра
                          </div>

                          <input
                            className="hg-input"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleMainImageUpload(e.target.files?.[0])}
                            disabled={mainImageUploading || formLoading}
                          />

                          {mainImageUploadMsg ? (
                            <div className="hg-note">{mainImageUploadMsg}</div>
                          ) : null}

                          {mainImageUploading ? (
                            <div className="hg-note">Качване на главната снимка...</div>
                          ) : null}

                          {productForm.imageUrl ? (
                            <div
                              style={{
                                width: 180,
                                height: 180,
                                borderRadius: 14,
                                border: "1px solid rgba(255,255,255,.14)",
                                backgroundImage: `url("${productForm.imageUrl}")`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                backgroundRepeat: "no-repeat",
                              }}
                            />
                          ) : null}
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: 10,
                            padding: 14,
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,.14)",
                            background: "rgba(255,255,255,.04)",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: 14,
                            }}
                          >
                            Качи допълнителни снимки за галерия
                          </div>

                          <input
                            className="hg-input"
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => handleGalleryImagesUpload(e.target.files)}
                            disabled={galleryUploading || formLoading}
                          />

                          {galleryUploadMsg ? (
                            <div className="hg-note">{galleryUploadMsg}</div>
                          ) : null}

                          {galleryUploading ? (
                            <div className="hg-note">
                              Качване на допълнителните снимки...
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <textarea
                        className="hg-textarea"
                        placeholder="Кратко описание"
                        value={productForm.shortDescription}
                        onChange={(e) =>
                          updateFormField("shortDescription", e.target.value)
                        }
                      />

                      <textarea
                        className="hg-textarea"
                        placeholder="Описание"
                        value={productForm.description}
                        onChange={(e) =>
                          updateFormField("description", e.target.value)
                        }
                      />

                      <textarea
                        className="hg-textarea"
                        placeholder="Съвместимост (по един ред, напр. Nespresso)"
                        value={productForm.compatibleWithText}
                        onChange={(e) =>
                          updateFormField("compatibleWithText", e.target.value)
                        }
                      />

                      <textarea
                        className="hg-textarea"
                        placeholder="Баджове (по един на ред, напр. Ново, Промо, Топ продукт)"
                        value={productForm.badgesText}
                        onChange={(e) => updateFormField("badgesText", e.target.value)}
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
                          disabled={formLoading || mainImageUploading || galleryUploading}
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

                    {adminItems.map((p) => {
                      const isSelected = selectedAdminIds.includes(p._id);

                      return (
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
                            <label className="hg-check" style={{ marginBottom: 10 }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleAdminSelection(p._id)}
                              />
                              Избери продукта
                            </label>

                            <h3 className="hg-cardTitle">{p.title}</h3>

                            <div className="hg-meta">
                              <span className="hg-pill">{p.brand || "без марка"}</span>
                              <span className="hg-pill">
                                {p.stockStatus || "unknown"}
                              </span>
                              <span className="hg-pill hg-pill--status">
                                статус: {p.status}
                              </span>
                              {p.isFeatured ? (
                                <span className="hg-pill hg-pill--ok">препоръчан</span>
                              ) : null}
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

                            <div className="hg-kpis">
                              Грамаж: <b>{p.weight ?? "-"}</b>
                              {p.weightUnit ? ` ${p.weightUnit}` : ""} • Интензитет:{" "}
                              <b>{p.intensity ?? "-"}</b>
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
                                className="hg-btn"
                                onClick={() =>
                                  setSingleFeatured(p._id, !p.isFeatured)
                                }
                                disabled={adminLoading}
                              >
                                {p.isFeatured ? "Махни препоръчан" : "Препоръчай"}
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
                      );
                    })}
                  </div>
                </>
              )}

              {adminSection === "orders" && (
                <>
                  <div className="hg-toolbar">
                    <select
                      className="hg-select"
                      value={orderStatusFilter}
                      onChange={(e) => setOrderStatusFilter(e.target.value)}
                    >
                      {ADMIN_ORDER_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {ADMIN_ORDER_STATUS_LABELS[status] || status}
                        </option>
                      ))}
                    </select>

                    <button
                      className="hg-btn"
                      onClick={loadAdminOrders}
                      disabled={ordersLoading}
                    >
                      Обнови поръчките
                    </button>

                    <div className="hg-counter">
                      Поръчки: <b>{adminOrders.length}</b>
                    </div>
                  </div>

                  {ordersMsg && <div className="hg-panel">{ordersMsg}</div>}
                  {ordersLoading && <div className="hg-panel">Зареждане…</div>}

                  {!ordersLoading && adminOrders.length === 0 && (
                    <div className="hg-panel">Няма поръчки за този филтър.</div>
                  )}

                  {!ordersLoading &&
                    adminOrders.map((order) => (
                      <div className="hg-panel" key={order._id}>
                        <div className="hg-panelTitle" style={{ marginBottom: 12 }}>
                          Поръчка #{String(order._id || "").slice(-6).toUpperCase()}
                        </div>

                        <div className="hg-kpis" style={{ marginBottom: 8 }}>
                          Дата: <b>{formatDateTime(order.createdAt)}</b>
                        </div>

                        <div className="hg-kpis" style={{ marginBottom: 8 }}>
                          Клиент: <b>{order.customerName || "—"}</b>
                        </div>

                        <div className="hg-kpis" style={{ marginBottom: 8 }}>
                          Телефон: <b>{order.phone || "—"}</b>
                        </div>

                        <div className="hg-kpis" style={{ marginBottom: 8 }}>
                          Град: <b>{order.city || "—"}</b> • Адрес:{" "}
                          <b>{order.address || "—"}</b>
                        </div>

                        {order.note ? (
                          <div className="hg-kpis" style={{ marginBottom: 10 }}>
                            Бележка: <b>{order.note}</b>
                          </div>
                        ) : null}

                        <div className="hg-meta" style={{ marginBottom: 12 }}>
                          <span className="hg-pill">
                            статус:{" "}
                            {ADMIN_ORDER_STATUS_LABELS[order.status] || order.status}
                          </span>
                          <span className="hg-pill">
                            общо: {formatPrice(order.total, order.currency || "BGN")}
                          </span>
                          <span className="hg-pill">
                            артикули:{" "}
                            {Array.isArray(order.items)
                              ? order.items.reduce(
                                  (sum, item) => sum + toNum(item?.qty),
                                  0
                                )
                              : 0}
                          </span>
                        </div>

                        <div className="hg-actions" style={{ marginBottom: 14 }}>
                          <button
                            className="hg-btn"
                            onClick={() => updateOrderStatus(order._id, "new")}
                          >
                            Нова
                          </button>
                          <button
                            className="hg-btn"
                            onClick={() =>
                              updateOrderStatus(order._id, "confirmed")
                            }
                          >
                            Потвърди
                          </button>
                          <button
                            className="hg-btn"
                            onClick={() => updateOrderStatus(order._id, "shipped")}
                          >
                            Изпрати
                          </button>
                          <button
                            className="hg-btn"
                            onClick={() =>
                              updateOrderStatus(order._id, "delivered")
                            }
                          >
                            Доставена
                          </button>
                          <button
                            className="hg-btn hg-btn--danger"
                            onClick={() =>
                              updateOrderStatus(order._id, "cancelled")
                            }
                          >
                            Откажи
                          </button>
                        </div>

                        <div className="hg-kpis" style={{ marginBottom: 8 }}>
                          <b>Продукти в поръчката:</b>
                        </div>

                        <div
                          className="hg-actions--wrap"
                          style={{ display: "grid", gap: 10 }}
                        >
                          {Array.isArray(order.items) && order.items.length > 0 ? (
                            order.items.map((item, idx) => (
                              <div
                                key={`${order._id}-${item?.productId || idx}`}
                                className="hg-check"
                                style={{
                                  minHeight: "auto",
                                  alignItems: "flex-start",
                                  flexDirection: "column",
                                  padding: "12px 14px",
                                }}
                              >
                                <div>
                                  <b>{item?.title || "Продукт"}</b>
                                </div>
                                <div className="hg-kpis">
                                  Количество: <b>{item?.qty ?? 0}</b> • Цена:{" "}
                                  <b>
                                    {formatPrice(
                                      item?.price,
                                      order.currency || "BGN"
                                    )}
                                  </b>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="hg-kpis">Няма артикули.</div>
                          )}
                        </div>
                      </div>
                    ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      {view === "public" && (
        <>
          {!isProductPage ? (
            <>
              <section className="hg-publicShell">
                <section className="hg-hero">
                  <div className="hg-hero__overlay" />

                  <div className="hg-hero__content">
                    <div className="hg-hero__eyebrow">Онлайн магазин за кафе продукти</div>

                    <h2 className="hg-hero__title">
                      Премиум кафе атмосфера за твоя дом, офис или бизнес
                    </h2>

                    <p className="hg-hero__text">
                      Подбрани продукти, силна визия и лесна поръчка в стил модерен
                      специализиран магазин за кафе.
                    </p>

                    <div className="hg-hero__cta">
                      <button
                        className="hg-btn hg-btn--primary"
                        onClick={() => {
                          const section = document.getElementById("hg-products-section");
                          if (section) section.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        Разгледай продуктите
                      </button>

                      <button
                        className="hg-btn"
                        onClick={() => applyQuickSearch("премиум кафе")}
                      >
                        Премиум селекция
                      </button>
                    </div>
                  </div>

                  <div className="hg-heroCategories">
                    {HERO_LINKS.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className="hg-heroCategory"
                        onClick={() => applyCategoryFilter(item.category)}
                      >
                        <div className="hg-heroCategoryIcon" aria-hidden="true">
                          {item.icon}
                        </div>
                        <div className="hg-heroCategoryTitle">{item.label}</div>
                        <div className="hg-heroCategoryLine" />
                      </button>
                    ))}
                  </div>
                </section>

                <section className="hg-chipSection">
                  <div className="hg-sectionHead">
                    <div>
                      <div className="hg-sectionEyebrow">Категории</div>
                      <h3 className="hg-sectionTitle">Избери какво търсиш</h3>
                    </div>
                  </div>

                  <div className="hg-chipGrid">
                    {PUBLIC_CATEGORY_CHIPS.map((chip) => (
                      <button
                        key={chip.label}
                        className="hg-chipCard"
                        onClick={() => applyCategoryFilter(chip.value)}
                      >
                        <span className="hg-chipCard__title">{chip.label}</span>
                        <span className="hg-chipCard__sub">Разгледай категорията</span>
                      </button>
                    ))}
                  </div>
                </section>
              </section>

              <div className="hg-toolbarWrap" id="hg-products-section">
                <div className="hg-sectionHead hg-sectionHead--toolbar">
                  <div>
                    <div className="hg-sectionEyebrow">Каталог</div>
                    <h3 className="hg-sectionTitle">Всички продукти</h3>
                  </div>
                </div>

                <div className="hg-toolbar">
                  <input
                    className="hg-input"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Търси кафе, капсули, машини, марка или продукт..."
                  />

                  <select
                    className="hg-select"
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="all">Всички категории</option>
                    {ADMIN_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

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

                  {(selectedCategory !== "all" || q) && (
                    <button className="hg-btn" onClick={clearPublicFilters}>
                      Изчисти филтрите
                    </button>
                  )}
                </div>
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

                        <div className="hg-kpis">
                          Грамаж: <b>{selectedProduct.weight ?? "-"}</b>
                          {selectedProduct.weightUnit
                            ? ` ${selectedProduct.weightUnit}`
                            : ""}{" "}
                          • Интензитет: <b>{selectedProduct.intensity ?? "-"}</b>
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
            </>
          ) : (
            <div className="hg-publicShell">
              <div className="hg-toolbarWrap">
                <div className="hg-toolbar">
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
                  <section className="hg-panel" style={{ marginBottom: 18 }}>
                    <div
                      className="hg-kpis"
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <button className="hg-btn" onClick={clearPublicFilters}>
                        Начало
                      </button>
                      <span>/</span>
                      <button
                        className="hg-btn"
                        onClick={() => applyCategoryFilter(productPage.category || "all")}
                      >
                        {categoryLabelFromValue(productPage.category) || "Продукти"}
                      </button>
                      <span>/</span>
                      <b>{productPage.title}</b>
                    </div>
                  </section>

                  <section className="hg-panel">
                    <div className="hg-productModal" style={{ gap: 24 }}>
                      <div>
                        <div
                          className="hg-productModal__image"
                          style={{
                            minHeight: 520,
                            backgroundImage: activeProductImage
                              ? `url("${activeProductImage}")`
                              : "linear-gradient(135deg,#eee,#f7f7f7)",
                          }}
                        />

                        {activeProductImages.length > 1 ? (
                          <div
                            className="hg-actions hg-actions--wrap"
                            style={{ marginTop: 14 }}
                          >
                            {activeProductImages.map((img, idx) => (
                              <button
                                key={`${img}-${idx}`}
                                type="button"
                                className="hg-btn"
                                onClick={() => setProductGalleryIndex(idx)}
                                style={{
                                  padding: 0,
                                  border:
                                    idx === productGalleryIndex
                                      ? "2px solid #111"
                                      : undefined,
                                }}
                              >
                                <div
                                  style={{
                                    width: 72,
                                    height: 72,
                                    borderRadius: 12,
                                    backgroundImage: `url("${img}")`,
                                    backgroundSize: "cover",
                                    backgroundPosition: "center",
                                  }}
                                />
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="hg-productModal__content">
                        <div className="hg-meta" style={{ marginBottom: 14 }}>
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
                          <span className="hg-pill">
                            {productPage.stockStatus === "in_stock"
                              ? "В наличност"
                              : productPage.stockStatus === "out_of_stock"
                              ? "Изчерпан"
                              : "Наличност: неизвестна"}
                          </span>
                        </div>

                        <h1
                          className="hg-productModal__title"
                          style={{ marginBottom: 16 }}
                        >
                          {productPage.title}
                        </h1>

                        <div className="hg-price" style={{ marginBottom: 18 }}>
                          {formatPrice(productPrice(productPage), productPage.currency)}
                        </div>

                        {productPage.shortDescription ? (
                          <div
                            className="hg-productModal__text"
                            style={{ marginBottom: 14 }}
                          >
                            {productPage.shortDescription}
                          </div>
                        ) : null}

                        {productPage.description ? (
                          <div
                            className="hg-productModal__text"
                            style={{ marginBottom: 14 }}
                          >
                            {productPage.description}
                          </div>
                        ) : null}

                        <div className="hg-kpis" style={{ marginBottom: 8 }}>
                          Наличност: <b>{productPage.stockQty ?? "-"}</b>
                        </div>

                        <div className="hg-kpis" style={{ marginBottom: 8 }}>
                          Доставка:{" "}
                          <b>
                            {productPage.shippingDays
                              ? `${productPage.shippingDays} дни`
                              : "—"}
                          </b>
                        </div>

                        <div className="hg-kpis" style={{ marginBottom: 8 }}>
                          Грамаж: <b>{productPage.weight ?? "-"}</b>
                          {productPage.weightUnit
                            ? ` ${productPage.weightUnit}`
                            : ""}
                        </div>

                        <div className="hg-kpis" style={{ marginBottom: 8 }}>
                          Интензитет: <b>{productPage.intensity ?? "-"}</b>
                        </div>

                        <div className="hg-kpis" style={{ marginBottom: 8 }}>
                          Изпичане: <b>{productPage.roastLevel || "-"}</b>
                        </div>

                        <div className="hg-kpis" style={{ marginBottom: 18 }}>
                          Кофеин: <b>{productPage.caffeineType || "-"}</b>
                        </div>

                        <div className="hg-actions hg-actions--wrap">
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

                  <section className="hg-panel" style={{ marginTop: 18 }}>
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
          )}

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

                        <form className="hg-checkoutForm" onSubmit={submitOrder}>
                          <div className="hg-checkoutGrid">
                            <input
                              className="hg-input"
                              placeholder="Име и фамилия *"
                              value={checkoutForm.customerName}
                              onChange={(e) =>
                                updateCheckoutField("customerName", e.target.value)
                              }
                            />

                            <input
                              className="hg-input"
                              placeholder="Телефон *"
                              value={checkoutForm.phone}
                              onChange={(e) =>
                                updateCheckoutField("phone", e.target.value)
                              }
                            />

                            <input
                              className="hg-input"
                              placeholder="Град"
                              value={checkoutForm.city}
                              onChange={(e) =>
                                updateCheckoutField("city", e.target.value)
                              }
                            />

                            <input
                              className="hg-input"
                              placeholder="Адрес"
                              value={checkoutForm.address}
                              onChange={(e) =>
                                updateCheckoutField("address", e.target.value)
                              }
                            />
                          </div>

                          <textarea
                            className="hg-textarea hg-textarea--light"
                            placeholder="Бележка към поръчката"
                            value={checkoutForm.note}
                            onChange={(e) =>
                              updateCheckoutField("note", e.target.value)
                            }
                          />

                          {orderMsg ? (
                            <div className="hg-note hg-note--order">{orderMsg}</div>
                          ) : null}

                          <div className="hg-actions">
                            <button
                              className="hg-btn hg-btn--primary"
                              type="submit"
                              disabled={orderLoading}
                            >
                              {orderLoading ? "Изпращане..." : "Изпрати поръчка"}
                            </button>

                            <button
                              className="hg-btn"
                              type="button"
                              onClick={clearCart}
                            >
                              Изчисти количката
                            </button>
                          </div>
                        </form>
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