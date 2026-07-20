import { useState, useEffect } from "react";
import { api } from "../api.js";

function RiskBadge({ churn }) {
  const label = churn === 1 ? "Churned" : "At risk";
  const bg = churn === 1 ? "var(--rose-dim)" : "var(--amber-dim)";
  const color = churn === 1 ? "var(--rose-bright)" : "var(--amber)";
  return (
    <span style={{ fontFamily: "IBM Plex Mono", fontSize: 11, padding: "2px 8px", borderRadius: 100, background: bg, color }}>
      {label}
    </span>
  );
}

export default function Copilot() {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selected, setSelected] = useState(null);
  const [explanation, setExplanation] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.highRiskUsers(15)
      .then((d) => setUsers(d.users))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingUsers(false));
  }, []);

  async function pickUser(u) {
    setSelected(u);
    setExplanation("");
    setEmail("");
    setError("");
    setBusy("explain");
    try {
      const d = await api.explainUser(u.user_id);
      setExplanation(d.explanation);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function genEmail(tone) {
    if (!selected) return;
    setBusy("email");
    setError("");
    try {
      const d = await api.winbackEmail(selected.user_id, tone);
      setEmail(d.email);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="wrap-wide" style={{ paddingTop: 36 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>AI Retention Copilot</div>
        <h1 className="serif" style={{ fontSize: 30, fontWeight: 600, marginBottom: 10 }}>
          Score → explanation → action, in one place.
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 15, maxWidth: 680, lineHeight: 1.6 }}>
          The model ranks the highest-risk users. Pick one and the AI reads their real
          profile to explain <em>why</em> they're at risk, then drafts a personalized win-back
          email you could send — turning a churn score into a next action.
        </p>
      </div>

      {error && (
        <div className="callout rose" style={{ marginBottom: 20 }}>
          <p>{error}{api.base.includes("localhost") ? " — is the backend running with OPENAI_API_KEY and Postgres?" : ""}</p>
        </div>
      )}

      <div className="grid-2" style={{ alignItems: "start" }}>
        {/* Left: high-risk user list */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="ctitle" style={{ padding: "18px 20px 12px" }}>Highest-risk users</div>
          {loadingUsers ? (
            <div style={{ padding: 20, color: "var(--muted-2)", fontSize: 13 }}>Loading…</div>
          ) : (
            <div style={{ maxHeight: 460, overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>User</th><th>Country</th><th className="num">Idle days</th>
                    <th className="num">Watch hrs</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.user_id}
                      onClick={() => pickUser(u)}
                      style={{
                        cursor: "pointer",
                        background: selected?.user_id === u.user_id ? "var(--surface-2)" : "transparent",
                      }}
                    >
                      <td>{u.name}<div style={{ color: "var(--muted-2)", fontSize: 11, fontFamily: "IBM Plex Mono" }}>#{u.user_id}</div></td>
                      <td style={{ color: "var(--muted)" }}>{u.country}</td>
                      <td className="num">{u.days_since_login}</td>
                      <td className="num">{Number(u.watch_time_hours).toFixed(1)}</td>
                      <td><RiskBadge churn={u.churn} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: AI explanation + email */}
        <div>
          {!selected && (
            <div className="card" style={{ color: "var(--muted-2)", fontSize: 14, textAlign: "center", padding: "50px 20px" }}>
              Select a user to see the AI risk explanation and draft a win-back email.
            </div>
          )}

          {selected && (
            <>
              <div className="card">
                <div className="ctitle">Why {selected.name} is at risk</div>
                {busy === "explain" ? (
                  <div style={{ color: "var(--muted-2)", fontSize: 13 }}>Analyzing profile…</div>
                ) : (
                  <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--text)", margin: 0 }}>{explanation}</p>
                )}
                <div style={{ display: "flex", gap: 14, marginTop: 16, flexWrap: "wrap", fontFamily: "IBM Plex Mono", fontSize: 11.5, color: "var(--muted)" }}>
                  <span>tenure: {selected.tenure_days}d</span>
                  <span>idle: {selected.days_since_login}d</span>
                  <span>watch: {Number(selected.watch_time_hours).toFixed(1)}h</span>
                  <span>tickets: {selected.support_tickets}</span>
                  <span>genre: {selected.favorite_genre}</span>
                </div>
              </div>

              <div className="card">
                <div className="ctitle" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>AI-drafted win-back email</span>
                  <span style={{ display: "flex", gap: 6 }}>
                    <button className="chip-btn" onClick={() => genEmail("professional")} disabled={busy === "email"}>Professional</button>
                    <button className="chip-btn" onClick={() => genEmail("playful")} disabled={busy === "email"}>Playful</button>
                  </span>
                </div>
                {busy === "email" ? (
                  <div style={{ color: "var(--muted-2)", fontSize: 13 }}>Drafting…</div>
                ) : email ? (
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: "Inter, sans-serif", fontSize: 14, lineHeight: 1.6, color: "var(--text)", margin: 0 }}>{email}</pre>
                ) : (
                  <div style={{ color: "var(--muted-2)", fontSize: 13 }}>Choose a tone to generate an email for {selected.name}.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18, color: "var(--muted-2)", fontSize: 12, fontFamily: "IBM Plex Mono", textAlign: "center" }}>
        Explanations and emails are generated by OpenAI from each user's real database record · rate-limited
      </div>
    </div>
  );
}
