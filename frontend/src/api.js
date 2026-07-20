const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

async function post(pathname, body) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function get(pathname) {
  const res = await fetch(`${API_BASE}${pathname}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  base: API_BASE,
  ask: (question) => post("/api/ask", { question }),
  highRiskUsers: (limit = 20) => get(`/api/high-risk-users?limit=${limit}`),
  explainUser: (user_id) => post("/api/explain-user", { user_id }),
  winbackEmail: (user_id, tone) => post("/api/winback-email", { user_id, tone }),
};
