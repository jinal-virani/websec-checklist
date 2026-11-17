const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    credentials: "include", // send the httpOnly session cookie
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const post = (path, body) => request(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  register: (body) => post("/auth/register", body),
  login: (body) => post("/auth/login", body),
  logout: () => post("/auth/logout", {}),
  me: () => request("/auth/me"),
  verifyEmail: (token) => post("/auth/verify-email", { token }),
  resendVerification: (body) => post("/auth/resend-verification", body),
  forgotPassword: (body) => post("/auth/forgot-password", body),
  resetPassword: (body) => post("/auth/reset-password", body),
  checklist: () => request("/checklist"),
  list: () => request("/assessments"),
  create: (body) => post("/assessments", body),
  get: (id) => request(`/assessments/${id}`),
  updateItem: (id, itemId, body) =>
    request(`/assessments/${id}/items/${itemId}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id) => request(`/assessments/${id}`, { method: "DELETE" }),
};

// Redirect to login when the session is missing/expired
export function handleAuthError(err) {
  if (err && err.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
    return true;
  }
  return false;
}
