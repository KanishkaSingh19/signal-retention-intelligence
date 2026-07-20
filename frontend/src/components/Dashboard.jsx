import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import data from "../data/data.json";

const COLORS = { amber: "#E8A33D", teal: "#56C2B4", rose: "#FF7A82", grid: "#20242F", muted: "#8D91A3" };
const PIE_COLORS = [COLORS.amber, COLORS.teal, COLORS.rose];

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1C202C", border: "1px solid #282D3C", borderRadius: 8, padding: "8px 12px", fontFamily: "IBM Plex Mono", fontSize: 12 }}>
      <div style={{ color: "#8D91A3" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
}

const axisTick = { fill: COLORS.muted, fontSize: 10.5, fontFamily: "IBM Plex Mono" };

function Bars({ obj, color, horizontal = false, max, height = 260 }) {
  const rows = Object.entries(obj).map(([k, v]) => ({ name: k, value: v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 4, right: 12, left: horizontal ? 40 : 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" domain={[0, max]} tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={axisTick} axisLine={false} tickLine={false} width={90} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: COLORS.grid }} tickLine={false} />
            <YAxis domain={[0, max]} tick={axisTick} axisLine={false} tickLine={false} />
          </>
        )}
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(255,255,255,.03)" }} />
        <Bar dataKey="value" fill={color} radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DecileBars() {
  const rows = data.risk_deciles.map((d) => ({ name: "D" + d.decile, value: d.churn_rate, decile: d.decile }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: COLORS.grid }} tickLine={false} />
        <YAxis domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(255,255,255,.03)" }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {rows.map((r, i) => (
            <Cell key={i} fill={r.decile >= 9 ? COLORS.rose : r.decile <= 3 ? COLORS.teal : COLORS.amber} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function fmtMonth(k) {
  const [y, m] = k.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en", { month: "short", year: "2-digit" });
}

function ExecPanel() {
  const subRows = Object.entries(data.users_by_subscription).map(([k, v]) => ({ name: k, value: v }));
  const sessionRows = Object.entries(data.monthly_sessions).map(([k, v]) => ({ name: fmtMonth(k), value: v }));
  return (
    <>
      <div className="grid-2">
        <div className="card">
          <div className="ctitle">Churn rate by predicted risk decile</div>
          <DecileBars />
        </div>
        <div className="card">
          <div className="ctitle">Users by subscription plan</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={subRows} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {subRows.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
              <Tooltip content={<Tip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="ctitle">Monthly watch sessions</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={sessionRows} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: COLORS.grid }} tickLine={false} interval={2} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip />} />
              <Line type="monotone" dataKey="value" stroke={COLORS.amber} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="ctitle">Churn rate by subscription tier</div>
          <Bars obj={data.churn_by_subscription} color={COLORS.rose} max={40} />
        </div>
      </div>
    </>
  );
}

function UserPanel() {
  const recencyRows = data.recency_curve.map((d) => ({ name: d.x, value: d.churn_rate }));
  return (
    <>
      <div className="grid-2">
        <div className="card">
          <div className="ctitle">Churn rate by days since last login</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={recencyRows} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: COLORS.grid }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip />} />
              <Line type="monotone" dataKey="value" stroke={COLORS.rose} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="ctitle">Churn rate by account tenure</div>
          <Bars obj={data.churn_by_tenure_band} color={COLORS.teal} max={50} />
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="ctitle">Churn rate by support tickets</div>
          <Bars obj={data.churn_by_support_tickets} color={COLORS.amber} max={65} />
        </div>
        <div className="card">
          <div className="ctitle">Churn rate by country</div>
          <Bars obj={data.churn_by_country} color={COLORS.rose} horizontal max={35} />
        </div>
      </div>
    </>
  );
}

function ContentPanel() {
  return (
    <>
      <div className="grid-2">
        <div className="card">
          <div className="ctitle">Views by genre</div>
          <Bars obj={data.genre_views} color={COLORS.amber} horizontal />
        </div>
        <div className="card">
          <div className="ctitle">Avg. completion rate by genre</div>
          <Bars obj={data.genre_completion} color={COLORS.teal} max={58} />
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="ctitle">Top rated titles (min. 15 ratings)</div>
          <table>
            <thead><tr><th>Title</th><th>Genre</th><th className="num">Avg Rating</th><th className="num">Ratings</th></tr></thead>
            <tbody>
              {data.top_content.map((r, i) => (
                <tr key={i}>
                  <td>{r.title}</td>
                  <td><span className="genre-pill">{r.genre}</span></td>
                  <td className="num">{r.avg_rating.toFixed(2)}</td>
                  <td className="num">{r.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="ctitle">Most watched titles</div>
          <table>
            <thead><tr><th>Title</th><th>Genre</th><th className="num">Views</th></tr></thead>
            <tbody>
              {data.most_watched_content.map((r, i) => (
                <tr key={i}>
                  <td>{r.title}</td>
                  <td><span className="genre-pill">{r.genre}</span></td>
                  <td className="num">{r.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function GrowthPanel() {
  const monthly = Object.keys(data.monthly_sessions).map((k) => ({
    name: fmtMonth(k),
    sessions: data.monthly_sessions[k],
    completion: data.monthly_completion[k],
  }));
  return (
    <>
      <div className="grid-2">
        <div className="card">
          <div className="ctitle">Monthly sessions vs. avg completion rate</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthly} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: COLORS.grid }} tickLine={false} interval={2} />
              <YAxis yAxisId="left" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" domain={[40, 60]} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
              <Bar yAxisId="left" dataKey="sessions" fill="rgba(232,163,61,.55)" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="completion" stroke={COLORS.teal} strokeWidth={2} dot={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="ctitle">Views by content release year</div>
          <Bars obj={data.views_by_release_year} color={COLORS.amber} />
        </div>
      </div>
      <div className="grid-3">
        <div className="card"><div className="ctitle">Avg. session duration</div><div className="kval mono" style={{ fontSize: 26, color: "var(--amber)", fontFamily: "Fraunces, serif" }}>{data.avg_session_duration} <span style={{ fontSize: 13, color: "var(--muted)" }}>min</span></div></div>
        <div className="card"><div className="ctitle">Avg. rating across platform</div><div className="kval mono" style={{ fontSize: 26, color: "var(--amber)", fontFamily: "Fraunces, serif" }}>{data.avg_rating} <span style={{ fontSize: 13, color: "var(--muted)" }}>/ 5</span></div></div>
        <div className="card"><div className="ctitle">Model ROC-AUC</div><div className="kval mono" style={{ fontSize: 26, color: "var(--amber)", fontFamily: "Fraunces, serif" }}>{data.model_auc}</div></div>
      </div>
    </>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState("exec");

  const kpis = [
    ["Total Users", data.total_users.toLocaleString(), ""],
    ["Churn Rate", data.churn_rate + "%", "accent"],
    ["Avg Tenure", Math.round(data.avg_tenure_days) + " days", ""],
    ["Countries", data.countries, ""],
    ["Total Sessions", data.total_sessions.toLocaleString(), ""],
    ["Top-Decile Capture", data.top2decile_capture_pct + "%", "risk"],
  ];

  const tabs = [
    ["exec", "Executive Overview"],
    ["user", "User & Retention"],
    ["content", "Content Analytics"],
    ["growth", "Growth & Engagement"],
  ];

  return (
    <div className="wrap-wide">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="serif" style={{ fontSize: 24, fontWeight: 600 }}>Retention Intelligence Dashboard</h1>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            25,000 users · 100,455 sessions · 40,131 ratings · 500 titles · 10 countries
          </div>
        </div>
      </div>

      <div className="kpi-row">
        {kpis.map(([label, val, cls]) => (
          <div className={`kpi ${cls}`} key={label}>
            <div className="klabel">{label}</div>
            <div className="kval mono">{val}</div>
          </div>
        ))}
      </div>

      <div className="dtabs">
        {tabs.map(([id, label]) => (
          <button key={id} className={`dtab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "exec" && <ExecPanel />}
      {tab === "user" && <UserPanel />}
      {tab === "content" && <ContentPanel />}
      {tab === "growth" && <GrowthPanel />}

      <div style={{ marginTop: 8, color: "var(--muted-2)", fontSize: 12, textAlign: "center", fontFamily: "IBM Plex Mono" }}>
        Data: modeled streaming-platform dataset (probabilistic churn generator)
      </div>
    </div>
  );
}
