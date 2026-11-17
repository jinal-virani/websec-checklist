"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api, handleAuthError } from "../../../lib/api";

const OPTIONS = ["Pass", "Fail", "N/A"];
const cssOf = (s) => (s === "N/A" ? "NA" : s);

export default function AssessmentPage() {
  const { id } = useParams();
  const [checklist, setChecklist] = useState([]);
  const [a, setA] = useState(null);
  const [filter, setFilter] = useState("All");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.checklist(), api.get(id)])
      .then(([c, asm]) => { setChecklist(c); setA(asm); })
      .catch((e) => { if (!handleAuthError(e)) setError(e.message); });
  }, [id]);

  const categories = useMemo(() => ["All", ...new Set(checklist.map((c) => c.category))], [checklist]);

  // Group items by category so each section can display the tools used to test it.
  const groups = useMemo(() => {
    const map = new Map();
    for (const item of checklist) {
      if (filter !== "All" && item.category !== filter) continue;
      if (!map.has(item.category)) {
        map.set(item.category, { name: item.category, tools: item.tools || [], items: [] });
      }
      map.get(item.category).items.push(item);
    }
    return [...map.values()];
  }, [checklist, filter]);

  const failed = useMemo(
    () => (a ? checklist.filter((c) => (a.items[c.id]?.status || "Pending") === "Fail") : []),
    [a, checklist]
  );

  async function update(itemId, body) {
    setA((prev) => ({ ...prev, items: { ...prev.items, [itemId]: { ...prev.items[itemId], ...body } } }));
    try {
      const r = await api.updateItem(id, itemId, body);
      setA((prev) => ({ ...prev, summary: r.summary }));
    } catch (e) { setError(e.message); }
  }

  if (error) return <p className="error">{error}</p>;
  if (!a) return <p className="muted">Loading…</p>;

  const s = a.summary;
  const pct = (n) => (n / s.total) * 100 + "%";

  return (
    <>
      <a href="/" className="no-print">Back to assessments</a>
      <div className="row">
        <div>
          <h1>{a.name}</h1>
          <div className="muted">{a.target || "No target set"} · {new Date(a.createdAt).toLocaleDateString()}</div>
        </div>
        <button className="ghost no-print" onClick={() => window.print()}>Print / save report as PDF</button>
      </div>

      <div className="panel">
        <div className="row">
          <div><div className="score">{s.score}%</div><div className="muted">compliance score (Pass ÷ applicable items)</div></div>
          <div className="stats">
            <span>Pass {s.pass}</span><span>Fail {s.fail}</span><span>N/A {s.na}</span><span>Pending {s.pending}</span>
          </div>
        </div>
        <div className="bar" aria-hidden="true">
          <span style={{ width: pct(s.pass), background: "var(--pass)" }} />
          <span style={{ width: pct(s.fail), background: "var(--fail)" }} />
          <span style={{ width: pct(s.na), background: "var(--na)" }} />
        </div>
      </div>

      <div className="panel print-only">
        <h2>Failed findings</h2>
        {failed.length === 0 ? <p>No failed items recorded.</p> : (
          <table>
            <thead><tr><th>ID</th><th>Finding</th><th>Severity</th><th>Remediation</th></tr></thead>
            <tbody>
              {failed.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.title}<br /><em>{a.items[c.id]?.notes}</em></td>
                  <td>{c.severity}</td>
                  <td>
                    {c.remediation}
                    {c.tools?.length > 0 && <div className="ref">Tools: {c.tools.join(", ")}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <label className="no-print" style={{ maxWidth: 320, marginBottom: 14 }}>Category
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>

      {groups.map((group) => (
        <section key={group.name} className="cat-group">
          <div className="cat-head">
            <h2>{group.name}</h2>
            {group.tools.length > 0 && (
              <div className="tools">
                <strong>Tools used:</strong>
                {group.tools.map((tool) => <span className="tool" key={tool}>{tool}</span>)}
              </div>
            )}
          </div>

          {group.items.map((c) => {
            const it = a.items[c.id] || { status: "Pending", notes: "" };
            return (
              <div key={c.id} className={`panel item ${cssOf(it.status)}`}>
                <div className="row">
                  <strong>{c.id} · {c.title}</strong>
                  <span className={`sev ${c.severity}`}>{c.severity}</span>
                </div>
                <div className="ref">{c.category} · {c.owasp} · Status: {it.status}</div>
                <div className="fix"><strong>Fix:</strong> {c.remediation}</div>
                <div className="choices no-print" role="group" aria-label={`Status for ${c.id}`}>
                  {OPTIONS.map((val) => (
                    <button key={val} className={it.status === val ? `on ${cssOf(val)}` : ""}
                      aria-pressed={it.status === val} onClick={() => update(c.id, { status: val })}>{val}</button>
                  ))}
                  <button onClick={() => update(c.id, { status: "Pending" })}>Reset</button>
                </div>
                <textarea className="no-print" placeholder="Notes / evidence (e.g. screenshot name, URL tested)" defaultValue={it.notes}
                  maxLength={1000} onBlur={(e) => e.target.value !== it.notes && update(c.id, { notes: e.target.value })} />
              </div>
            );
          })}
        </section>
      ))}
    </>
  );
}
