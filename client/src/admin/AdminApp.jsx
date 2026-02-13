// client/src/admin/AdminApp.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, clearToken, getToken } from "./api";

export default function AdminApp() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      // ⚠️ ТУК endpoint-ът може да е различен според твоя routes/admin.products.js
      // Ако не знаеш — пусни ми този файл и ще го вържа 100% точно.
      const data = await apiFetch("/admin/products?status=pending&limit=50");
      setItems(data?.items || data?.products || data || []);
    } catch (e) {
      setErr(e.message || "Admin load failed");
      // ако е 401/403 → връщаме към login
      if (e.status === 401 || e.status === 403) {
        clearToken();
        nav("/admin/login", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) {
      nav("/admin/login", { replace: true });
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function approve(id) {
    try {
      await apiFetch(`/admin/products/${id}/approve`, { method: "POST" });
      await load();
    } catch (e) {
      alert(e.message || "Approve failed");
    }
  }

  async function reject(id) {
    try {
      await apiFetch(`/admin/products/${id}/reject`, { method: "POST" });
      await load();
    } catch (e) {
      alert(e.message || "Reject failed");
    }
  }

  function logout() {
    clearToken();
    nav("/admin/login", { replace: true });
  }

  return (
    <div style={{ maxWidth: 1100, margin: "30px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 28 }}>Admin Panel</h2>
          <div style={{ color: "rgba(0,0,0,.6)", marginTop: 6 }}>Pending products / moderation</div>
        </div>
        <button
          onClick={logout}
          style={{ height: 40, padding: "0 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,.15)", background: "#fff", cursor: "pointer", fontWeight: 700 }}
        >
          Logout
        </button>
      </div>

      {err ? (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px solid rgba(220,38,38,.25)", background: "rgba(220,38,38,.06)" }}>
          {err}
        </div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {items?.length ? items.map((p) => (
              <div key={p._id} style={{ border: "1px solid rgba(0,0,0,.12)", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800 }}>{p.title || "(no title)"}</div>
                  <div style={{ color: "rgba(0,0,0,.6)", fontSize: 13, marginTop: 4 }}>
                    {p.category || "-"} • clicks: {p.clicks ?? 0} • views: {p.views ?? 0}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={() => approve(p._id)} style={{ height: 36, padding: "0 12px", borderRadius: 10, border: "none", background: "#111827", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
                    Approve
                  </button>
                  <button onClick={() => reject(p._id)} style={{ height: 36, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,.15)", background: "#fff", fontWeight: 800, cursor: "pointer" }}>
                    Reject
                  </button>
                </div>
              </div>
            )) : (
              <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(0,0,0,.10)" }}>
                Няма pending продукти.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
