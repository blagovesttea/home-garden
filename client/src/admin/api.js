// client/src/admin/api.js
const API_BASE =
  process.env.NODE_ENV === "production"
    ? "" // same domain (Render): frontend + backend together
    : "http://localhost:8000";

export function getToken() {
  try { return localStorage.getItem("hg_token") || ""; } catch { return ""; }
}

export function setToken(token) {
  try { localStorage.setItem("hg_token", token); } catch {}
}

export function clearToken() {
  try { localStorage.removeItem("hg_token"); } catch {}
}

export async function apiFetch(path, { method = "GET", body, headers = {} } = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // ако backend върне HTML (примерно index.html), ще го хванем
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not json */ }

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
