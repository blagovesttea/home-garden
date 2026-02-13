// client/src/admin/AdminLogin.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, setToken } from "./api";

export default function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: { email, password },
      });

      // token може да е data.token или data.accessToken или data?.data?.token
      const token =
        data?.token ||
        data?.accessToken ||
        data?.data?.token ||
        data?.result?.token ||
        "";

      if (!token) throw new Error("Login OK, но не получих token от сървъра.");

      setToken(token);
      nav("/admin", { replace: true });
    } catch (e2) {
      setErr(e2.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: 16 }}>
      <h2 style={{ margin: 0, fontSize: 28 }}>Admin Login</h2>
      <p style={{ color: "rgba(0,0,0,.6)", marginTop: 8 }}>
        Въведи админ акаунта си.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          required
          style={{ height: 44, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,.15)" }}
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          required
          style={{ height: 44, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,.15)" }}
        />
        {err ? (
          <div style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(220,38,38,.25)", background: "rgba(220,38,38,.06)" }}>
            {err}
          </div>
        ) : null}

        <button
          disabled={loading}
          style={{
            height: 44,
            borderRadius: 10,
            border: "none",
            background: "#111827",
            color: "#fff",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.75 : 1,
          }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
