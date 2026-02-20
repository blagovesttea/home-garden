import { useEffect, useMemo, useState } from "react";
import "./App.css";

// ✅ API base (local + production same-origin)
const API =
  process.env.NODE_ENV === "production"
    ? window.location.origin
    : "http://localhost:8000";

const ADMIN_STATUSES = ["all", "new", "approved", "rejected", "blacklisted"];

// ✅ BG labels (UI only) — логиката НЕ се пипа
const ADMIN_STATUS_LABELS = {
  all: "Всички",
  new: "Нови",
  approved: "Одобрени",
  rejected: "Отхвърлени",
  blacklisted: "Черен списък",
};

// Public sort (client-side fallback) — BG labels only
const SORTS = [
  { value: "popular", label: "Най-популярни" }, // clicks desc
  { value: "profit", label: "Най-добра печалба" }, // profitScore desc
  { value: "newest", label: "Най-нови" }, // createdAt desc
  { value: "priceAsc", label: "Цена (ниска → висока)" },
  { value: "priceDesc", label: "Цена (висока → ниска)" },
];

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function joinPath(pathArr) {
  if (!Array.isArray(pathArr)) return "";
  return pathArr.filter(Boolean).join("/");
}

function pathPrefixMatch(productPath, selectedPath) {
  // selectedPath is string like "home/kitchen"
  if (!selectedPath || selectedPath === "all") return true;

  const sel = String(selectedPath).trim().toLowerCase();
  if (!sel) return true;

  const pArr = Array.isArray(productPath) ? productPath : [];
  const p = pArr.join("/").toLowerCase();

  // exact prefix match: p starts with sel
  return p === sel || p.startsWith(sel + "/");
}

// fallback mapping when product has only legacy "category"
function legacyToRootPath(legacy) {
  const c = String(legacy || "").toLowerCase();
  if (!c || c === "all") return "";
  if (["home", "kitchen", "storage"].includes(c)) return "home";
  if (["garden", "outdoor", "tools"].includes(c)) return "garden";
  return "";
}

/** ✅ Build tree from flat categories without touching backend */
function buildCategoryTreeFromFlat(categoriesFlat) {
  const items = Array.isArray(categoriesFlat) ? categoriesFlat : [];

  // nodeMap by pathKey
  const map = new Map();

  function ensureNode(key) {
    if (!key) return null;
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: key.split("/").slice(-1)[0] || key,
        level: Math.max(0, key.split("/").length - 1),
        children: [],
        _order: 999999,
      });
    }
    return map.get(key);
  }

  // 1) create nodes
  items.forEach((c, idx) => {
    const key = joinPath(c.path || []) || c.slug || "";
    if (!key) return;

    map.set(key, {
      key,
      name: c.name || c.slug || key,
      level: Number(c.level || Math.max(0, key.split("/").length - 1)),
      children: [],
      raw: c,
      _order: idx,
    });
  });

  // 2) attach to parent by path prefix (slice)
  const roots = [];
  map.forEach((node) => {
    const parts = String(node.key).split("/").filter(Boolean);
    if (parts.length <= 1) {
      roots.push(node);
      return;
    }
    const parentKey = parts.slice(0, -1).join("/");
    const parent = ensureNode(parentKey);

    if (parent) parent.children.push(node);
    else roots.push(node);
  });

  // 3) sort children by original order to keep stable
  function sortNode(n) {
    n.children.sort((a, b) => (a._order ?? 0) - (b._order ?? 0));
    n.children.forEach(sortNode);
  }
  roots.sort((a, b) => (a._order ?? 0) - (b._order ?? 0));
  roots.forEach(sortNode);

  // 4) remove duplicates in children (in case)
  function dedupe(n) {
    const seen = new Set();
    n.children = n.children.filter((ch) => {
      if (seen.has(ch.key)) return false;
      seen.add(ch.key);
      return true;
    });
    n.children.forEach(dedupe);
  }
  roots.forEach(dedupe);

  return roots;
}

function App() {
  /* =========================
     AUTH (login + admin)
  ========================== */
  const [view, setView] = useState("public"); // public | admin

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem("token") || "";
    } catch {
      return "";
    }
  });

  const [me, setMe] = useState(null); // { id, role, email? }
  const [meLoading, setMeLoading] = useState(false);
  const isAdmin = me?.role === "admin";

  // login form
  const [loginEmail, setLoginEmail] = useState("test@test.com");
  const [loginPass, setLoginPass] = useState("Test1234");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMsg, setAuthMsg] = useState("");

  // ✅ admin-only: show stats in public (for you only)
  const [showStats, setShowStats] = useState(false);
  useEffect(() => {
    if (token && isAdmin) setShowStats(true);
    else setShowStats(false);
  }, [token, isAdmin]);

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  /**
   * ✅ robust fetch:
   * - чете text
   * - опитва JSON parse
   * - ако получи HTML (doctype) -> дава ясна грешка
   * - добавя Authorization автоматично ако има token
   */
  async function apiFetch(path, opts = {}) {
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
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
          ? "Сървърът върна HTML (грешен endpoint или React страница)."
          : `HTTP ${res.status}`);

      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      err.raw = text;
      throw err;
    }

    return data;
  }

  // load /auth/me whenever token changes
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
        setAuthMsg("Сесията е невалидна/изтекла. Влез отново.");
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

  /**
   * ✅ Admin view guard (FIXED):
   * - ако view=admin и няма token -> оставяме те в admin (да видиш login form)
   * - ако има token, но /auth/me още се зарежда -> НЕ връщаме към public
   * - ако /auth/me е заредено и не си admin -> връщаме към public
   */
  useEffect(() => {
    if (view !== "admin") return;

    if (!token) return; // show login form
    if (meLoading) return; // wait for /auth/me

    if (!isAdmin) {
      setAuthMsg("Влязъл си, но нямаш админ права.");
      setView("public");
    }
  }, [view, token, meLoading, isAdmin]);

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
      setAuthMsg("Успешен вход ✅");
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
     CATEGORIES (Catalog)
  ========================== */
  const [categoriesFlat, setCategoriesFlat] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // selected category as path string e.g. "home/kitchen/cookware"
  const [category, setCategory] = useState("all");

  // ✅ mobile drawer for categories
  const [catsOpen, setCatsOpen] = useState(false);

  // ✅ tree expand/collapse state
  const [expandedCats, setExpandedCats] = useState(() => new Set(["home", "garden"]));

  async function loadCategories() {
    setCategoriesLoading(true);
    try {
      const data = await apiFetch("/categories/flat", { method: "GET" });
      setCategoriesFlat(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setCategoriesFlat([]);
    } finally {
      setCategoriesLoading(false);
    }
  }

  useEffect(() => {
    if (view !== "public") return;
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const categoryOptions = useMemo(() => {
    const items = Array.isArray(categoriesFlat) ? categoriesFlat : [];

    const opts = items.map((c) => {
      const p = joinPath(c.path || []);
      const indent = "— ".repeat(Math.max(0, Number(c.level || 0)));
      const label = `${indent}${c.name}`;
      return { value: p || c.slug, label, level: Number(c.level || 0), raw: c };
    });

    // Deduplicate values
    const seen = new Set();
    const unique = [];
    for (const o of opts) {
      if (!o.value || seen.has(o.value)) continue;
      seen.add(o.value);
      unique.push(o);
    }

    return [
      {
        value: "all",
        label: categoriesLoading ? "Зареждане..." : "Всички категории",
        level: 0,
      },
      ...unique,
    ];
  }, [categoriesFlat, categoriesLoading]);

  // ✅ Build tree (subcategories)
  const categoryTree = useMemo(() => {
    return buildCategoryTreeFromFlat(categoriesFlat);
  }, [categoriesFlat]);

  function selectCategory(v) {
    setCategory(v);
    setCatsOpen(false);

    // auto-expand parents for better UX
    if (v && v !== "all") {
      const parts = String(v).split("/").filter(Boolean);
      if (parts.length > 1) {
        setExpandedCats((prev) => {
          const next = new Set(prev);
          for (let i = 1; i < parts.length; i++) {
            next.add(parts.slice(0, i).join("/"));
          }
          return next;
        });
      }
    }

    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
  }

  function toggleExpand(key) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function CategoryTree({ nodes }) {
    if (!Array.isArray(nodes) || nodes.length === 0) return null;

    return (
      <ul className="hg-catTree">
        {nodes.map((n) => {
          const hasKids = Array.isArray(n.children) && n.children.length > 0;
          const isExpanded = expandedCats.has(n.key);

          return (
            <li key={n.key} className="hg-catNode">
              <div className="hg-catRow">
                {hasKids ? (
                  <button
                    type="button"
                    className={`hg-catToggle ${isExpanded ? "is-open" : ""}`}
                    onClick={() => toggleExpand(n.key)}
                    aria-label={isExpanded ? "Скрий подкатегории" : "Покажи подкатегории"}
                    title={isExpanded ? "Скрий" : "Покажи"}
                  >
                    ▸
                  </button>
                ) : (
                  <span className="hg-catToggle hg-catToggle--ghost" aria-hidden="true">
                    ▸
                  </span>
                )}

                <button
                  type="button"
                  className={`hg-catBtn ${category === n.key ? "is-active" : ""}`}
                  onClick={() => selectCategory(n.key)}
                >
                  <span className="hg-catDot" />
                  <span className="hg-catName">{n.name}</span>
                </button>
              </div>

              {hasKids && isExpanded ? <CategoryTree nodes={n.children} /> : null}
            </li>
          );
        })}
      </ul>
    );
  }

  /* =========================
     PUBLIC LIST
  ========================== */
  const [mode, setMode] = useState("topProfit"); // latest | topClicks | topProfit
  const [q, setQ] = useState("");

  // shop-like controls
  const [sort, setSort] = useState("profit");
  const [onlyBG, setOnlyBG] = useState(false);
  const [fastShip, setFastShip] = useState(false);

  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  const [qDebounced, setQDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [mode, qDebounced, category, onlyBG, fastShip]);

  const queryStringForLatest = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (qDebounced) params.set("q", qDebounced);

    // ✅ send catalog path
    if (category && category !== "all") params.set("category", category);

    if (onlyBG) params.set("shippingToBG", "true");
    if (fastShip) params.set("maxShippingDays", "5");

    // ✅ ensure approved only (even if backend changes)
    params.set("status", "approved");

    return params.toString();
  }, [page, limit, qDebounced, category, onlyBG, fastShip]);

  useEffect(() => {
    if (view !== "public") return;

    let aborted = false;

    async function load() {
      setLoading(true);
      setErrMsg("");

      try {
        let url = "";

        // ✅ add status=approved to top endpoints too
        if (mode === "topClicks")
          url = `${API}/products/top?by=clicks&limit=60&status=approved`;
        else if (mode === "topProfit")
          url = `${API}/products/top?by=profitScore&limit=60&status=approved`;
        else url = `${API}/products?${queryStringForLatest}`;

        const res = await fetch(url);
        const text = await res.text();

        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = null;
        }

        if (aborted) return;

        if (!res.ok) {
          const msg =
            data?.message ||
            (text?.includes("<!doctype")
              ? "Сървърът върна HTML (не JSON)."
              : `HTTP ${res.status}`);
          throw new Error(msg);
        }

        // ✅ IMPORTANT FIX:
        // - /products returns {items:[...]}
        // - /products/top returns {items:[...]}
        let items = [];
        if (Array.isArray(data)) items = data;
        else if (Array.isArray(data?.items)) items = data.items;
        else items = [];

        // ✅ hard safety: public shows only approved
        items = items.filter(
          (p) => String(p?.status || "").toLowerCase() === "approved"
        );

        setProducts(items);

        if (mode === "latest") {
          setMeta({
            total: Number(data?.total || items.length || 0),
            page: Number(data?.page || page),
            limit: Number(data?.limit || limit),
          });
        } else {
          setMeta({ total: items.length, page: 1, limit: items.length });
        }
      } catch (e) {
        if (!aborted) setErrMsg(e?.message || "Грешка при зареждане");
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    load();
    return () => {
      aborted = true;
    };
  }, [view, mode, queryStringForLatest, page, limit]);

  const totalPages = useMemo(() => {
    if (mode !== "latest") return 1;
    return Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || 20)));
  }, [mode, meta]);

  // client-side shop filters + sorting (safe fallback)
  const publicItems = useMemo(() => {
    let items = Array.isArray(products) ? [...products] : [];

    // ✅ safety: approved only
    items = items.filter(
      (p) => String(p?.status || "").toLowerCase() === "approved"
    );

    // ✅ Category filtering (catalog first, then legacy fallback)
    if (category && category !== "all") {
      items = items.filter((p) => {
        const okCatalog = pathPrefixMatch(p.categoryPath, category);
        if (
          okCatalog &&
          Array.isArray(p.categoryPath) &&
          p.categoryPath.length
        )
          return true;

        // fallback: legacy bucket root match (home/garden)
        const root = legacyToRootPath(p.category);
        if (!root) return false;
        return category === root || category.startsWith(root + "/");
      });
    }

    if (qDebounced) {
      const qq = qDebounced.toLowerCase();
      items = items.filter((p) =>
        String(p.title || "").toLowerCase().includes(qq)
      );
    }

    if (onlyBG) items = items.filter((p) => !!p.shippingToBG);
    if (fastShip)
      items = items.filter(
        (p) => toNum(p.shippingDays) > 0 && toNum(p.shippingDays) <= 5
      );

    items.sort((a, b) => {
      if (sort === "popular") return toNum(b.clicks) - toNum(a.clicks);
      if (sort === "profit") return toNum(b.profitScore) - toNum(a.profitScore);
      if (sort === "priceAsc") return toNum(a.price) - toNum(b.price);
      if (sort === "priceDesc") return toNum(b.price) - toNum(a.price);
      if (sort === "newest") {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      }
      return 0;
    });

    if (mode !== "latest") items = items.slice(0, 24);

    return items;
  }, [products, category, qDebounced, onlyBG, fastShip, sort, mode]);

  /* =========================
     ADMIN PANEL
  ========================== */
  const [adminStatus, setAdminStatus] = useState("new");
  const [adminItems, setAdminItems] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMsg, setAdminMsg] = useState("");

  // ✅ seed categories action
  const [seedCatsLoading, setSeedCatsLoading] = useState(false);

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
      setAdminMsg(e?.message || "Грешка при зареждане (Admin)");
      setAdminItems([]);
    } finally {
      setAdminLoading(false);
    }
  }

  useEffect(() => {
    if (view !== "admin") return;
    if (!token) return; // login screen
    if (meLoading) return; // wait
    if (!isAdmin) return; // will be redirected by guard

    loadAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, adminStatus, token, me?.role, meLoading, isAdmin]);

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
      await apiFetch(`/admin/products/${id}`, {
        method: "DELETE",
      });
      await loadAdmin();
    } catch (e) {
      setAdminMsg(e?.message || "Грешка при изтриване");
    }
  }

  async function approveExistingNew() {
    setAdminMsg("");
    try {
      try {
        const r1 = await apiFetch(`/admin/products/approve-existing`, {
          method: "POST",
        });
        setAdminMsg(
          `Одобрени: matched ${r1?.matched ?? "-"} / modified ${r1?.modified ?? "-"}`
        );
      } catch {
        const r2 = await apiFetch(`/admin/products/backfill`, {
          method: "POST",
        });
        setAdminMsg(
          `Backfill OK: scanned ${r2?.scanned ?? "-"} / updated ${r2?.updated ?? "-"}`
        );
      }

      await loadAdmin();
    } catch (e) {
      setAdminMsg(e?.message || "Грешка при масово одобрение");
    }
  }

  // ✅ Seed categories (admin only)
  async function seedCategories() {
    setAdminMsg("");
    if (!token) {
      setAdminMsg("Няма токен. Влез първо.");
      return;
    }
    if (!isAdmin) {
      setAdminMsg("Нямаш админ права.");
      return;
    }

    setSeedCatsLoading(true);
    try {
      // ✅ IMPORTANT: your server exposes POST /categories/seed
      const r = await apiFetch(`/categories/seed`, { method: "POST" });

      const msg =
        r?.message ||
        (r?.count != null
          ? `Категориите са добавени. Общо: ${r.count}`
          : "Категориите са добавени.");
      setAdminMsg(msg);

      // refresh categories in UI
      await loadCategories();
      setCategory("all");
      setExpandedCats(new Set(["home", "garden"]));
    } catch (e) {
      setAdminMsg(e?.message || "Грешка при добавяне на категории");
    } finally {
      setSeedCatsLoading(false);
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
            <h1 className="hg-title">Home &amp; Garden</h1>
            <div className="hg-sub">
              {view === "public" ? (
                <>
                  Преглед:{" "}
                  <b>
                    {mode === "topProfit"
                      ? "Най-добра печалба"
                      : mode === "topClicks"
                      ? "Най-кликвани"
                      : "Най-нови"}
                  </b>
                </>
              ) : (
                <>
                  Админ панел{" "}
                  {meLoading ? (
                    <b className="hg-pill">проверка…</b>
                  ) : isAdmin ? (
                    <b className="hg-pill hg-pill--ok">админ</b>
                  ) : (
                    <b className="hg-pill hg-pill--bad">няма права</b>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="hg-topActions">
          <div className="hg-switch">
            <button
              className={`hg-switchBtn ${view === "public" ? "is-active" : ""}`}
              onClick={() => setView("public")}
              disabled={view === "public"}
            >
              Магазин
            </button>

            {/* ✅ Admin tab is always accessible to reach login */}
            <button
              className={`hg-switchBtn ${view === "admin" ? "is-active" : ""}`}
              onClick={() => setView("admin")}
              disabled={view === "admin"}
              title={
                !token
                  ? "Отвори админ вход"
                  : isAdmin
                  ? "Отвори админ панел"
                  : "Нямаш админ права"
              }
            >
              Админ{!token ? " (вход)" : ""}
            </button>
          </div>

          {token ? (
            <>
              <div className="hg-userChip">
                роля: <b>{me?.role || (meLoading ? "проверка…" : "неизвестна")}</b>
              </div>
              <button className="hg-btn" onClick={doLogout}>
                Изход
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* ✅ Login in ADMIN view */}
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

      {view === "admin" && (
        <div>
          {!token ? (
            <div className="hg-panel hg-panel--bad">Влез първо.</div>
          ) : meLoading ? null : !isAdmin ? (
            <div className="hg-panel hg-panel--bad">
              Нямаш админ права (роля: {me?.role || "неизвестна"}).
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

                <button className="hg-btn" onClick={loadAdmin} disabled={adminLoading}>
                  Обнови
                </button>

                <button
                  className="hg-btn"
                  onClick={approveExistingNew}
                  disabled={adminLoading}
                >
                  Одобри всички НОВИ
                </button>

                <button
                  className="hg-btn"
                  onClick={seedCategories}
                  disabled={seedCatsLoading || adminLoading}
                  title="Създава стандартен каталог с категории"
                >
                  {seedCatsLoading ? "Добавяне..." : "Добави категории"}
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

              <div className="hg-grid">
                {!adminLoading && adminItems.length === 0 && (
                  <div className="hg-panel">Няма продукти за този филтър.</div>
                )}

                {adminItems.map((p) => (
                  <div className="hg-card" key={p._id}>
                    <div className="hg-cardTop">
                      <h3 className="hg-cardTitle">{p.title}</h3>
                      <div className="hg-meta">
                        <span className="hg-pill">{p.category}</span>
                        <span className="hg-pill">{p.source}</span>
                        <span className="hg-pill hg-pill--status">статус: {p.status}</span>
                      </div>
                    </div>

                    <div className="hg-kpis">
                      Каталог:{" "}
                      <b>
                        {Array.isArray(p.categoryPath) && p.categoryPath.length
                          ? p.categoryPath.join(" / ")
                          : "-"}
                      </b>
                    </div>

                    <div className="hg-price">
                      {p.price} {p.currency}
                    </div>

                    <div className="hg-kpis">
                      Оценка: <b>{p.score ?? 0}</b> • ProfitScore:{" "}
                      <b>{p.profitScore ?? 0}</b> • Преглеждания: <b>{p.views ?? 0}</b> •
                      Кликове: <b>{p.clicks ?? 0}</b>
                    </div>

                    <div className="hg-url">{p.sourceUrl}</div>

                    <div className="hg-actions hg-actions--wrap">
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

                      <a
                        className="hg-link"
                        href={`${API}/products/${p._id}/click`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Отвори оферта →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* =========================
         ✅ PUBLIC (категории с подкатегории + клик върху снимка към оферта)
      ========================== */}
      {view === "public" && (
        <>
          {/* ✅ Mobile drawer for categories */}
          <div
            className={`hg-backdrop ${catsOpen ? "is-open" : ""}`}
            onClick={() => setCatsOpen(false)}
            aria-hidden={!catsOpen}
          />
          <aside className={`hg-drawer ${catsOpen ? "is-open" : ""}`}>
            <div className="hg-sideTitle">
              <h3>Категории</h3>
              <span className="hg-sideHint">
                {categoriesLoading ? "Зареждане…" : "Подкатегории"}
              </span>
            </div>

            <div className="hg-catTop">
              <button
                type="button"
                className={`hg-catBtn ${category === "all" ? "is-active" : ""}`}
                onClick={() => selectCategory("all")}
              >
                <span className="hg-catDot" />
                <span className="hg-catName">Всички категории</span>
              </button>
            </div>

            <CategoryTree nodes={categoryTree} />
          </aside>

          <div className="hg-main">
            {/* ✅ Desktop sidebar */}
            <aside className="hg-side">
              <div className="hg-sideTitle">
                <h3>Категории</h3>
                <span className="hg-sideHint">
                  {categoriesLoading ? "Зареждане…" : "Подкатегории"}
                </span>
              </div>

              <div className="hg-catTop">
                <button
                  type="button"
                  className={`hg-catBtn ${category === "all" ? "is-active" : ""}`}
                  onClick={() => selectCategory("all")}
                >
                  <span className="hg-catDot" />
                  <span className="hg-catName">Всички категории</span>
                </button>
              </div>

              <CategoryTree nodes={categoryTree} />
            </aside>

            {/* ✅ Content */}
            <div>
              <div className="hg-toolbar">
                {/* ✅ Mobile open categories */}
                <button
                  type="button"
                  className="hg-catOpenBtn"
                  onClick={() => setCatsOpen(true)}
                >
                  Категории
                </button>

                <input
                  className="hg-input"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Търси продукти..."
                />

                {/* dropdown оставям — не пречи и е удобен fallback */}
                <select
                  className="hg-select"
                  value={category}
                  onChange={(e) => selectCategory(e.target.value)}
                >
                  {categoryOptions.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
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

                <div className="hg-chips">
                  <button
                    type="button"
                    className={`hg-chip ${onlyBG ? "is-on" : ""}`}
                    onClick={() => setOnlyBG((v) => !v)}
                  >
                    Доставка до BG
                  </button>
                  <button
                    type="button"
                    className={`hg-chip ${fastShip ? "is-on" : ""}`}
                    onClick={() => setFastShip((v) => !v)}
                  >
                    Бърза доставка
                  </button>

                  {token && isAdmin ? (
                    <button
                      type="button"
                      className={`hg-chip ${showStats ? "is-on" : ""}`}
                      onClick={() => setShowStats((v) => !v)}
                      title="Покажи статистики (само за админ)"
                    >
                      Статистики
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="hg-modes">
                <button
                  className={`hg-btn ${mode === "topProfit" ? "hg-btn--primary" : ""}`}
                  onClick={() => setMode("topProfit")}
                >
                  Най-добра печалба
                </button>
                <button
                  className={`hg-btn ${mode === "topClicks" ? "hg-btn--primary" : ""}`}
                  onClick={() => setMode("topClicks")}
                >
                  Най-кликвани
                </button>
                <button
                  className={`hg-btn ${mode === "latest" ? "hg-btn--primary" : ""}`}
                  onClick={() => setMode("latest")}
                >
                  Най-нови
                </button>
              </div>

              {loading && <div className="hg-panel">Зареждане…</div>}
              {!loading && errMsg && <div className="hg-panel hg-panel--bad">{errMsg}</div>}

              {!loading && mode === "latest" && (
                <div className="hg-pager">
                  <button
                    className="hg-btn"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Назад
                  </button>
                  <div className="hg-counter">
                    Страница <b>{page}</b> / <b>{totalPages}</b> — Общо: <b>{meta.total}</b>
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
                {!loading && publicItems.length === 0 && (
                  <div className="hg-panel">Няма продукти.</div>
                )}

                {publicItems.map((p) => (
                  <div className="hg-card" key={p._id}>
                    {/* ✅ ВАЖНО: Клик върху снимката отваря офертата. Няма Details/View Offer бутон */}
                    <a
                      className="hg-thumbLink"
                      href={`${API}/products/${p._id}/click`}
                      target="_blank"
                      rel="noreferrer"
                      title="Отвори оферта"
                      style={{
                        backgroundImage: p.imageUrl
                          ? `url("${p.imageUrl}")`
                          : "linear-gradient(135deg,#eee,#f7f7f7)",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat",
                      }}
                    >
                      <span className="hg-thumbOverlay">Отвори оферта →</span>
                    </a>

                    <div className="hg-cardBody">
                      <h3 className="hg-cardTitle">{p.title}</h3>

                      <div className="hg-meta">
                        <span className="hg-pill">
                          {Array.isArray(p.categoryPath) && p.categoryPath.length
                            ? p.categoryPath.join(" / ")
                            : p.category}
                        </span>
                        <span className="hg-pill">{p.source}</span>

                        {p.shippingToBG ? (
                          <span className="hg-pill hg-pill--ok">Доставка до BG</span>
                        ) : (
                          <span className="hg-pill">Без доставка до BG</span>
                        )}

                        {toNum(p.shippingDays) > 0 && (
                          <span className="hg-pill">
                            {toNum(p.shippingDays)} ден{toNum(p.shippingDays) === 1 ? "" : "а"}
                          </span>
                        )}
                      </div>

                      {token && isAdmin && showStats ? (
                        <div className="hg-kpis">
                          Преглеждания: <b>{p.views ?? 0}</b> • Кликове: <b>{p.clicks ?? 0}</b> •
                          ProfitScore: <b>{p.profitScore ?? 0}</b> • Оценка: <b>{p.score ?? 0}</b>
                        </div>
                      ) : null}

                      <div className="hg-price">
                        {p.price} {p.currency}
                      </div>

                      {/* ✅ няма бутони тук – снимката е “бутон” */}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
