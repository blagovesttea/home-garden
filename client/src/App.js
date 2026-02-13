import { useEffect, useMemo, useState } from "react";
import "./App.css";

// ✅ API base (local + optional env for later deploy)
const API =
  process.env.NODE_ENV === "production"
    ? window.location.origin
    : "http://localhost:8000";


const CATEGORIES = [
  "all",
  "home",
  "garden",
  "tools",
  "outdoor",
  "kitchen",
  "storage",
  "other",
];

const ADMIN_STATUSES = ["all", "new", "approved", "rejected", "blacklisted"];

// Public sort (client-side fallback)
const SORTS = [
  { value: "popular", label: "Most popular" }, // clicks desc
  { value: "profit", label: "Best profit" }, // profitScore desc
  { value: "newest", label: "Newest" }, // createdAt desc (if exists) else no-op
  { value: "priceAsc", label: "Price (low → high)" },
  { value: "priceDesc", label: "Price (high → low)" },
];

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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
  const isAdmin = me?.role === "admin";

  // login form
  const [loginEmail, setLoginEmail] = useState("test@test.com");
  const [loginPass, setLoginPass] = useState("Test1234");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMsg, setAuthMsg] = useState("");

  // ✅ admin-only: show stats in public (for you only)
  const [showStats, setShowStats] = useState(false);
  useEffect(() => {
    // default ON for admin (so you see clicks/views while testing)
    if (token && isAdmin) setShowStats(true);
    else setShowStats(false);
  }, [token, isAdmin]);

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  async function apiFetch(path, opts = {}) {
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const msg = data?.message || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
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
        if (view === "admin") setView("public");
        return;
      }

      try {
        const data = await apiFetch("/auth/me", {
          method: "GET",
          headers: { ...authHeaders },
        });

        if (aborted) return;
        setMe(data?.user || null);
      } catch {
        if (aborted) return;
        setMe(null);
        setToken("");
        try {
          localStorage.removeItem("token");
        } catch {}
        setAuthMsg("Token invalid/expired. Please login again.");
        setView("public");
      }
    }

    loadMe();
    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // hard guard: never allow admin view if not admin
  useEffect(() => {
    if (view === "admin" && (!token || !isAdmin)) setView("public");
  }, [view, token, isAdmin]);

  async function doLogin(e) {
    e?.preventDefault?.();
    setAuthLoading(true);
    setAuthMsg("");

    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      });

      const t = data?.token || "";
      if (!t) throw new Error("No token returned");

      setToken(t);
      try {
        localStorage.setItem("token", t);
      } catch {}

      setAuthMsg("Login OK");
      setView("admin");
    } catch (e2) {
      setAuthMsg(e2?.message || "Login error");
    } finally {
      setAuthLoading(false);
    }
  }

  function doLogout() {
    setMe(null);
    setToken("");
    setAuthMsg("");
    setView("public");
    try {
      localStorage.removeItem("token");
    } catch {}
  }

  /* =========================
     PUBLIC LIST
  ========================== */
  const [mode, setMode] = useState("topProfit"); // latest | topClicks | topProfit
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");

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
    if (category && category !== "all") params.set("category", category);

    if (onlyBG) params.set("shippingToBG", "true");
    if (fastShip) params.set("maxShippingDays", "5");

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

        if (mode === "topClicks") url = `${API}/products/top?by=clicks&limit=60`;
        else if (mode === "topProfit")
          url = `${API}/products/top?by=profitScore&limit=60`;
        else url = `${API}/products?${queryStringForLatest}`;

        const res = await fetch(url);
        const data = await res.json();

        if (aborted) return;

        const items = Array.isArray(data.items) ? data.items : [];
        setProducts(items);

        if (mode === "latest") {
          setMeta({
            total: Number(data.total || 0),
            page: Number(data.page || page),
            limit: Number(data.limit || limit),
          });
        } else {
          setMeta({ total: items.length, page: 1, limit: items.length });
        }
      } catch (e) {
        if (!aborted) setErrMsg(e?.message || "Load error");
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

    if (category && category !== "all") {
      items = items.filter((p) => String(p.category || "").toLowerCase() === category);
    }

    if (qDebounced) {
      const qq = qDebounced.toLowerCase();
      items = items.filter((p) => String(p.title || "").toLowerCase().includes(qq));
    }

    if (onlyBG) items = items.filter((p) => !!p.shippingToBG);
    if (fastShip) items = items.filter(
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

  async function loadAdmin() {
    if (!token) {
      setAdminMsg("No token. Login first.");
      return;
    }
    if (!isAdmin) {
      setAdminMsg("You are not admin.");
      return;
    }

    setAdminLoading(true);
    setAdminMsg("");

    try {
      const qs = new URLSearchParams();
      if (adminStatus && adminStatus !== "all") qs.set("status", adminStatus);

      const data = await apiFetch(`/admin/products?${qs.toString()}`, {
        method: "GET",
        headers: { ...authHeaders },
      });

      setAdminItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setAdminMsg(e?.message || "Admin load error");
      setAdminItems([]);
    } finally {
      setAdminLoading(false);
    }
  }

  useEffect(() => {
    if (view !== "admin") return;
    loadAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, adminStatus, token, me?.role]);

  async function setStatus(id, status) {
    setAdminMsg("");
    try {
      await apiFetch(`/admin/products/${id}/status`, {
        method: "PATCH",
        headers: { ...authHeaders },
        body: JSON.stringify({ status }),
      });
      await loadAdmin();
    } catch (e) {
      setAdminMsg(e?.message || "Status update error");
    }
  }

  async function deleteProduct(id) {
    setAdminMsg("");
    try {
      await apiFetch(`/admin/products/${id}`, {
        method: "DELETE",
        headers: { ...authHeaders },
      });
      await loadAdmin();
    } catch (e) {
      setAdminMsg(e?.message || "Delete error");
    }
  }

  async function approveExistingNew() {
    setAdminMsg("");
    try {
      try {
        const r1 = await apiFetch(`/admin/products/approve-existing`, {
          method: "POST",
          headers: { ...authHeaders },
        });
        setAdminMsg(
          `Approved existing: matched ${r1.matched ?? "-"} / modified ${r1.modified ?? "-"}`
        );
      } catch {
        const r2 = await apiFetch(`/admin/products/backfill`, {
          method: "POST",
          headers: { ...authHeaders },
        });
        setAdminMsg(`Backfill OK: scanned ${r2.scanned ?? "-"} / updated ${r2.updated ?? "-"}`);
      }

      await loadAdmin();
    } catch (e) {
      setAdminMsg(e?.message || "Approve existing error");
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
                  Browse:{" "}
                  <b>
                    {mode === "topProfit"
                      ? "Best Profit Picks"
                      : mode === "topClicks"
                      ? "Most Clicked"
                      : "Latest"}
                  </b>
                </>
              ) : (
                <>
                  Admin panel{" "}
                  {isAdmin ? (
                    <b className="hg-pill hg-pill--ok">admin</b>
                  ) : (
                    <b className="hg-pill hg-pill--bad">no admin</b>
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
              Shop
            </button>

            {token && isAdmin ? (
              <button
                className={`hg-switchBtn ${view === "admin" ? "is-active" : ""}`}
                onClick={() => setView("admin")}
                disabled={view === "admin"}
              >
                Admin
              </button>
            ) : null}
          </div>

          {view === "admin" && token ? (
            <>
              <div className="hg-userChip">
                role: <b>{me?.role || "unknown"}</b>
              </div>
              <button className="hg-btn" onClick={doLogout}>
                Logout
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* ✅ Login only in ADMIN view */}
      {view === "admin" && !token && (
        <form className="hg-panel" onSubmit={doLogin}>
          <div className="hg-panelTitle">Admin Login</div>

          <div className="hg-loginGrid">
            <input
              className="hg-input"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="email"
              autoComplete="email"
            />
            <input
              className="hg-input"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              placeholder="password"
              type="password"
              autoComplete="current-password"
            />
            <button className="hg-btn hg-btn--primary" type="submit" disabled={authLoading}>
              {authLoading ? "..." : "Login"}
            </button>
          </div>

          {authMsg && <div className="hg-note">{authMsg}</div>}
        </form>
      )}

      {view === "admin" && token && authMsg && <div className="hg-panel">{authMsg}</div>}

      {view === "admin" && (
        <div>
          {!token ? (
            <div className="hg-panel hg-panel--bad">Login first.</div>
          ) : !isAdmin ? (
            <div className="hg-panel hg-panel--bad">
              You are not admin (role: {me?.role || "unknown"}).
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
                      {s === "all" ? "All statuses" : s}
                    </option>
                  ))}
                </select>

                <button className="hg-btn" onClick={loadAdmin} disabled={adminLoading}>
                  Refresh
                </button>

                <button className="hg-btn" onClick={approveExistingNew} disabled={adminLoading}>
                  Approve existing NEW
                </button>

                <div className="hg-counter">
                  Items: <b>{adminItems.length}</b>
                </div>

                <button className="hg-btn" onClick={doLogout}>
                  Logout
                </button>
              </div>

              {adminMsg && <div className="hg-panel">{adminMsg}</div>}
              {adminLoading && <div className="hg-panel">Loading…</div>}

              <div className="hg-grid">
                {!adminLoading && adminItems.length === 0 && (
                  <div className="hg-panel">No admin products for this filter.</div>
                )}

                {adminItems.map((p) => (
                  <div className="hg-card" key={p._id}>
                    <div className="hg-cardTop">
                      <h3 className="hg-cardTitle">{p.title}</h3>
                      <div className="hg-meta">
                        <span className="hg-pill">{p.category}</span>
                        <span className="hg-pill">{p.source}</span>
                        <span className="hg-pill hg-pill--status">status: {p.status}</span>
                      </div>
                    </div>

                    <div className="hg-price">
                      {p.price} {p.currency}
                    </div>

                    <div className="hg-kpis">
                      Score: <b>{p.score ?? 0}</b> • ProfitScore: <b>{p.profitScore ?? 0}</b> •
                      Views: <b>{p.views ?? 0}</b> • Clicks: <b>{p.clicks ?? 0}</b>
                    </div>

                    <div className="hg-url">{p.sourceUrl}</div>

                    <div className="hg-actions hg-actions--wrap">
                      <button
                        className="hg-btn"
                        onClick={() => setStatus(p._id, "approved")}
                        disabled={adminLoading}
                      >
                        Approve
                      </button>
                      <button
                        className="hg-btn"
                        onClick={() => setStatus(p._id, "rejected")}
                        disabled={adminLoading}
                      >
                        Reject
                      </button>
                      <button
                        className="hg-btn"
                        onClick={() => setStatus(p._id, "blacklisted")}
                        disabled={adminLoading}
                      >
                        Blacklist
                      </button>
                      <button
                        className="hg-btn hg-btn--danger"
                        onClick={() => deleteProduct(p._id)}
                        disabled={adminLoading}
                      >
                        Delete
                      </button>

                      <a
                        className="hg-link"
                        href={`${API}/products/${p._id}/click`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open click →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {view === "public" && (
        <div>
          <div className="hg-toolbar">
            <input
              className="hg-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products..."
            />

            <select
              className="hg-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All categories" : c}
                </option>
              ))}
            </select>

            <select className="hg-select" value={sort} onChange={(e) => setSort(e.target.value)}>
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
                Shipping to BG
              </button>
              <button
                type="button"
                className={`hg-chip ${fastShip ? "is-on" : ""}`}
                onClick={() => setFastShip((v) => !v)}
              >
                Fast delivery
              </button>

              {/* ✅ admin-only toggle for stats in public */}
              {token && isAdmin ? (
                <button
                  type="button"
                  className={`hg-chip ${showStats ? "is-on" : ""}`}
                  onClick={() => setShowStats((v) => !v)}
                  title="Show clicks/views/profit score (admin only)"
                >
                  Show stats
                </button>
              ) : null}
            </div>
          </div>

          <div className="hg-modes">
            <button
              className={`hg-btn ${mode === "topProfit" ? "hg-btn--primary" : ""}`}
              onClick={() => setMode("topProfit")}
            >
              Top Profit
            </button>
            <button
              className={`hg-btn ${mode === "topClicks" ? "hg-btn--primary" : ""}`}
              onClick={() => setMode("topClicks")}
            >
              Top Clicks
            </button>
            <button
              className={`hg-btn ${mode === "latest" ? "hg-btn--primary" : ""}`}
              onClick={() => setMode("latest")}
            >
              Latest
            </button>
          </div>

          {loading && <div className="hg-panel">Loading…</div>}
          {!loading && errMsg && <div className="hg-panel hg-panel--bad">{errMsg}</div>}

          {!loading && mode === "latest" && (
            <div className="hg-pager">
              <button
                className="hg-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Prev
              </button>
              <div className="hg-counter">
                Page <b>{page}</b> / <b>{totalPages}</b> — Total: <b>{meta.total}</b>
              </div>
              <button
                className="hg-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          )}

          <div className="hg-grid">
            {!loading && publicItems.length === 0 && <div className="hg-panel">No products.</div>}

            {publicItems.map((p) => (
              <div className="hg-card" key={p._id}>
                <div className="hg-thumb" aria-hidden="true" />

                <div className="hg-cardBody">
                  <h3 className="hg-cardTitle">{p.title}</h3>

                  <div className="hg-meta">
                    <span className="hg-pill">{p.category}</span>
                    <span className="hg-pill">{p.source}</span>

                    {p.shippingToBG ? (
                      <span className="hg-pill hg-pill--ok">Ships to BG</span>
                    ) : (
                      <span className="hg-pill">No BG shipping</span>
                    )}

                    {toNum(p.shippingDays) > 0 && (
                      <span className="hg-pill">
                        {toNum(p.shippingDays)} day{toNum(p.shippingDays) === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>

                  {/* ✅ admin-only stats (in public, only if you toggle it) */}
                  {token && isAdmin && showStats ? (
                    <div className="hg-kpis">
                      Views: <b>{p.views ?? 0}</b> • Clicks: <b>{p.clicks ?? 0}</b> • ProfitScore:{" "}
                      <b>{p.profitScore ?? 0}</b> • Score: <b>{p.score ?? 0}</b>
                    </div>
                  ) : null}

                  <div className="hg-price">
                    {p.price} {p.currency}
                  </div>

                  <div className="hg-actions">
                    <a
                      className="hg-btn hg-btn--primary"
                      href={`${API}/products/${p._id}/click`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View offer →
                    </a>

                    <a
                      className="hg-mini"
                      href={`${API}/products/${p._id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Details
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
