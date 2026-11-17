"use client";
import { useEffect, useState } from "react";
import { api, handleAuthError } from "../lib/api";

export default function Home() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = logged out
  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    api.me().then(setUser).catch((e) => {
      setUser(null);
      if (e.status !== 401) setError("Backend not reachable. Start the API on port 5000.");
    });
  }, []);

  const load = () => api.list().then(setList).catch((e) => { handleAuthError(e); });
  useEffect(() => { if (user) load(); }, [user]);

  // auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  async function create(e) {
    e.preventDefault();
    setError("");
    if (!user) {
      setToast("Please login first to start an assessment.");
      return;
    }
    if (!name.trim()) return setError("Assessment name is required.");
    try {
      const a = await api.create({ name, target });
      window.location.href = `/assessment/${a.id}`;
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this assessment?")) return;
    await api.remove(id);
    load();
  }

  return (
    <>
      {toast && (
        <div className="toast" role="alert">
          <span>{toast}</span>
          <a className="toast-action" href="/login">Login</a>
          <button className="toast-close" aria-label="Close message" onClick={() => setToast("")}>×</button>
        </div>
      )}

      <h1>Security assessments</h1>
      <p className="muted">Create an assessment for an application you are authorised to review, then work through the checklist.</p>

      <form className="panel create" onSubmit={create} noValidate>
        <label>Assessment name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Juice Shop lab audit" maxLength={100} />
        </label>
        <label>Target application
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. http://localhost:3001" maxLength={200} />
        </label>
        <button type="submit">Start assessment</button>
      </form>
      {error && <p className="error">{error}</p>}

      <h2>Your assessments</h2>
      {user === null && <p className="muted">Login to see and manage your assessments.</p>}
      {user && list.length === 0 && <p className="muted">No assessments yet. Start one above.</p>}
      {user && list.map((a) => (
        <div className="panel row" key={a.id}>
          <div>
            <strong>{a.name}</strong>
            <div className="muted">{a.target || "No target set"} · {new Date(a.createdAt).toLocaleDateString()}</div>
            <div className="stats">
              <span>Score {a.summary.score}%</span>
              <span>Pass {a.summary.pass}</span>
              <span>Fail {a.summary.fail}</span>
              <span>Pending {a.summary.pending}</span>
            </div>
          </div>
          <div className="row">
            <a className="btn" href={`/assessment/${a.id}`}>Open</a>
            <button className="danger" onClick={() => remove(a.id)}>Delete</button>
          </div>
        </div>
      ))}
    </>
  );
}
