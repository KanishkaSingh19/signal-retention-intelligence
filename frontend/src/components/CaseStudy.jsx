import { useEffect, useRef, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import data from "../data/data.json";

/* ------------------------------------------------------------------ *
 * Signal — Case Study
 * Design language: "analytical instrument meets editorial data-story".
 * Deep indigo-slate base, warm paper contrast, single cobalt accent,
 * one risk-red reserved strictly for churn/danger data.
 * All styles are scoped under .cs- to avoid colliding with index.css
 * or the other tabs (Dashboard / Copilot / Ask Signal).
 * ------------------------------------------------------------------ */

const INK = "#4C6EF5";       // cobalt accent
const RISK = "#F0517A";      // reserved for churn/danger data only
const GRID = "#242A3D";

/* ---- tiny hook: reveal on scroll ---- */
function useReveal() {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && (setShown(true), io.disconnect()),
      { threshold: 0.16 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, shown];
}

function Reveal({ children, delay = 0, className = "" }) {
  const [ref, shown] = useReveal();
  return (
    <div
      ref={ref}
      className={`cs-reveal ${shown ? "cs-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ---- animated count-up (respects reduced-motion) ---- */
function Counter({ value, decimals = 0, suffix = "", duration = 1400 }) {
  const [ref, shown] = useReveal();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!shown) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      return;
    }
    let raf, start;
    const tick = (t) => {
      if (!start) start = t;
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, value, duration]);
  const shown_ = decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString();
  return <span ref={ref}>{shown_}{suffix}</span>;
}

/* ---- hero motif: a decay curve of user-dots thinning left→right ---- *
 * This is the literal thing the product predicts (users slipping away),
 * rendered as the page's signature element rather than a stock gradient. */
function DecayField() {
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cols = 34, rows = 7;
  const dots = [];
  for (let c = 0; c < cols; c++) {
    // survival probability falls as we move right
    const survival = Math.pow(1 - c / (cols - 1), 1.35);
    for (let r = 0; r < rows; r++) {
      const jitter = (Math.sin(c * 2.3 + r * 1.7) + 1) / 2;
      const alive = jitter < survival * 1.15;
      dots.push({ c, r, alive, survival, key: `${c}-${r}` });
    }
  }
  return (
    <div className="cs-decay" aria-hidden="true">
      <svg viewBox={`0 0 ${cols * 18} ${rows * 18}`} preserveAspectRatio="xMidYMid meet">
        {dots.map(({ c, r, alive, survival, key }) => (
          <circle
            key={key}
            cx={c * 18 + 9}
            cy={r * 18 + 9}
            r={alive ? 3 : 2.2}
            className={alive ? "cs-dot cs-dot-live" : "cs-dot cs-dot-lost"}
            style={{
              animationDelay: reduce ? "0s" : `${c * 60 + r * 24}ms`,
              ["--surv"]: survival.toFixed(2),
            }}
          />
        ))}
        {/* faint trend line following the decay */}
        <path
          className="cs-decay-line"
          d={Array.from({ length: cols }).map((_, c) => {
            const y = 9 + (rows - 1) * 18 * (1 - Math.pow(1 - c / (cols - 1), 1.35));
            return `${c === 0 ? "M" : "L"} ${c * 18 + 9} ${y}`;
          }).join(" ")}
        />
      </svg>
      <div className="cs-decay-tags">
        <span>engaged</span>
        <span>at risk</span>
        <span className="cs-risk-tag">churned</span>
      </div>
    </div>
  );
}

/* ---- chart tooltip ---- */
function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="cs-tip">
      <span className="cs-tip-k">{label}</span>
      <span className="cs-tip-v">{payload[0].value}%</span>
    </div>
  );
}

function BandChart({ obj, color, max = 60 }) {
  const rows = Object.entries(obj).map(([k, v]) => ({ name: k, value: v }));
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={rows} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "#868FB0", fontSize: 10.5, fontFamily: "JetBrains Mono, monospace" }} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis domain={[0, max]} tick={{ fill: "#868FB0", fontSize: 10.5, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(255,255,255,.03)" }} />
        <Bar dataKey="value" radius={[5, 5, 0, 0]} fill={color} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DecileChart() {
  const rows = data.risk_deciles.map((d) => ({ name: "D" + d.decile, value: d.churn_rate, decile: d.decile }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} margin={{ top: 6, right: 6, left: -8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="2 4" stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "#868FB0", fontSize: 10.5, fontFamily: "JetBrains Mono, monospace" }} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: "#868FB0", fontSize: 10.5, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(255,255,255,.03)" }} />
        <Bar dataKey="value" radius={[5, 5, 0, 0]}>
          {rows.map((r, i) => (
            <Cell key={i} fill={r.decile >= 9 ? RISK : r.decile <= 3 ? INK : "#5A6488"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function CaseStudy({ onExplore }) {
  const parity = [
    ["Country", data.churn_by_country],
    ["Age band", data.churn_by_age_band],
    ["Subscription plan", data.churn_by_subscription],
  ];

  /* subtle parallax on the hero motif */
  const heroRef = useRef(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onScroll = () => {
      const y = window.scrollY;
      if (heroRef.current) heroRef.current.style.transform = `translateY(${y * 0.12}px)`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="cs-root">
      <style>{CS_STYLES}</style>

      {/* ============== HERO ============== */}
      <header className="cs-hero">
        <div className="cs-hero-grid">
          <div className="cs-hero-copy">
            <div className="cs-eyebrow"><span className="cs-eyebrow-dot" />Retention intelligence · case study</div>
            <h1 className="cs-h1">
              Half of all churn hides in
              <span className="cs-h1-accent"> one-fifth </span>
              of your users.
            </h1>
            <p className="cs-lede">
              A streaming platform wanted a churn model it could act on — not another KPI dashboard.
              This is how a behavioral risk score beat demographic segmentation, where the model breaks,
              and what I'd build next.
            </p>
            <div className="cs-hero-cta">
              <button className="cs-btn cs-btn-primary" onClick={onExplore}>
                Explore the live dashboard
                <span className="cs-btn-arrow">→</span>
              </button>
              <a className="cs-btn cs-btn-ghost" href="https://github.com/KanishkaSingh19/signal-retention-intelligence" target="_blank" rel="noreferrer">
                View the code
              </a>
            </div>
          </div>
          <div className="cs-hero-motif" ref={heroRef}>
            <DecayField />
          </div>
        </div>

        {/* stat ribbon */}
        <div className="cs-ribbon">
          {[
            ["Users modeled", <Counter key="u" value={25000} />],
            ["Watch sessions", <Counter key="w" value={100455} />],
            ["Ratings", <Counter key="r" value={40131} />],
            ["Model ROC-AUC", <Counter key="a" value={0.863} decimals={3} />],
            ["Stack", <span key="s" className="cs-ribbon-stack">SQL · Python · React · OpenAI</span>],
          ].map(([k, v]) => (
            <div className="cs-ribbon-cell" key={k}>
              <div className="cs-ribbon-v">{v}</div>
              <div className="cs-ribbon-k">{k}</div>
            </div>
          ))}
        </div>
      </header>

      {/* ============== 01 THE QUESTION ============== */}
      <section className="cs-sec cs-sec-question">
        <Reveal>
          <div className="cs-marker">01 — The question</div>
          <div className="cs-question-grid">
            <h2 className="cs-h2">
              A quarter of users churn each cycle. <em>Which</em> quarter matters far more than the average.
            </h2>
            <div className="cs-question-body">
              <p>
                Base churn sits at <span className="cs-stat-inline"><Counter value={data.churn_rate} decimals={2} suffix="%" /></span>.
                Operationally that number is useless — a retention team can't target "everyone." The real
                question: can a small, well-chosen slice be flagged <em>before</em> they leave, accurately
                enough to be worth acting on?
              </p>
              <p className="cs-muted">
                I modeled it across four linked tables — users, watch history, ratings, content — with SQL on a
                real PostgreSQL database for aggregation, Python (pandas + scikit-learn) for the churn model,
                React for this write-up, and an OpenAI text-to-SQL agent so anyone can query the data in plain
                English.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============== 02 WHAT DOESN'T PREDICT ============== */}
      <section className="cs-sec">
        <Reveal>
          <div className="cs-marker">02 — The false lead</div>
          <h2 className="cs-h2 cs-h2-wide">Demographics are almost noise. Behavior isn't.</h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="cs-p cs-p-narrow">
            Country, subscription tier, and age all sit within a couple of points of the base rate. Whole
            categories a marketing team might obsess over — barely moving the needle:
          </p>
          <div className="cs-parity">
            {parity.map(([label, obj]) => {
              const vals = Object.values(obj);
              const lo = Math.min(...vals), hi = Math.max(...vals);
              return (
                <div className="cs-parity-item" key={label}>
                  <div className="cs-parity-label">{label}</div>
                  <div className="cs-parity-range">{lo.toFixed(1)}<span>–</span>{hi.toFixed(1)}<i>%</i></div>
                  <div className="cs-parity-bar"><span style={{ width: `${(hi - lo) / 30 * 100}%` }} /></div>
                  <div className="cs-parity-spread">{(hi - lo).toFixed(1)} pt spread</div>
                </div>
              );
            })}
          </div>
          <p className="cs-p cs-p-narrow cs-muted">
            Favorite genre shows a wider raw spread — but it mostly <strong>vanishes in the multivariate model</strong>.
            Genre coefficients shrink to near-zero once watch time and recency are controlled for: genre was a
            proxy for how much someone watches, not a cause of churn. A classic confounder, worth catching before
            you trust any single-variable chart.
          </p>
        </Reveal>
      </section>

      {/* ============== 03 WHAT ACTUALLY PREDICTS ============== */}
      <section className="cs-sec cs-sec-dark">
        <Reveal>
          <div className="cs-marker cs-marker-invert">03 — The real signal</div>
          <h2 className="cs-h2 cs-h2-wide">Two behavioral signals carry the model.</h2>
          <p className="cs-p cs-p-narrow">
            A logistic regression put <strong>days since last login</strong> and <strong>cumulative watch time</strong>
            {" "}ahead of every other feature by 5–7×. Support tickets and account tenure followed.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="cs-metrics">
            {[
              ["ROC-AUC", data.model_auc, 3, ""],
              ["Accuracy", data.model_accuracy, 1, "%"],
              ["Precision", data.model_precision, 1, "%"],
              ["Recall", data.model_recall, 1, "%"],
            ].map(([k, v, d, s]) => (
              <div className="cs-metric" key={k}>
                <div className="cs-metric-v"><Counter value={v} decimals={d} suffix={s} /></div>
                <div className="cs-metric-k">{k}</div>
              </div>
            ))}
          </div>
        </Reveal>

        <div className="cs-charts-2">
          <Reveal delay={60} className="cs-panel">
            <div className="cs-panel-head">
              <span className="cs-panel-title">Churn by account tenure</span>
              <span className="cs-panel-note">new accounts are the highest-risk segment</span>
            </div>
            <BandChart obj={data.churn_by_tenure_band} color={RISK} max={50} />
          </Reveal>
          <Reveal delay={140} className="cs-panel">
            <div className="cs-panel-head">
              <span className="cs-panel-title">Churn by support tickets</span>
              <span className="cs-panel-note">each ticket roughly doubles churn odds</span>
            </div>
            <BandChart obj={data.churn_by_support_tickets} color={INK} max={65} />
          </Reveal>
        </div>
      </section>

      {/* ============== 04 THE FINDING (signature) ============== */}
      <section className="cs-sec cs-sec-finding">
        <Reveal>
          <div className="cs-marker">04 — The finding</div>
          <h2 className="cs-h2 cs-h2-lead">
            Ranking beats thresholding. The top <span className="cs-big-accent">20%</span> of scored users
            hold <span className="cs-big-risk">{data.top2decile_capture_pct}%</span> of all churn.
          </h2>
        </Reveal>

        <div className="cs-finding-grid">
          <Reveal className="cs-panel cs-panel-lg">
            <div className="cs-panel-head">
              <span className="cs-panel-title">Churn rate by predicted risk decile</span>
              <span className="cs-panel-note">D1 = lowest 10% risk · D10 = highest 10%</span>
            </div>
            <DecileChart />
          </Reveal>

          <Reveal delay={100} className="cs-finding-aside">
            <p>
              Instead of a hard cutoff on any one metric, every user is scored and sorted into deciles — a clean,
              monotonic lift curve.
            </p>
            <div className="cs-pull">
              <div className="cs-pull-fig"><Counter value={data.top2decile_capture_pct} suffix="%" /></div>
              <div className="cs-pull-cap">of churners live in the top 2 deciles — 20% of users. Targeting there
                cuts outreach 5× while still reaching most at-risk users.</div>
            </div>
            <p className="cs-muted cs-small">
              Recall is {data.model_recall}% as a yes/no classifier — it'd miss half of churners. The lift view
              sidesteps that: ask for a <em>ranking</em>, then spend the budget top-down. The live Copilot ranks
              with a lightweight behavioral proxy mirroring this curve.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ============== 05 RECOMMENDATIONS ============== */}
      <section className="cs-sec">
        <Reveal>
          <div className="cs-marker">05 — What to do about it</div>
          <h2 className="cs-h2 cs-h2-wide">Spend the retention budget on rank, not rules.</h2>
        </Reveal>
        <div className="cs-recs">
          {[
            ["Route deciles 9–10 into proactive win-back", `20% of users, ${data.top2decile_capture_pct}% of churn — the highest-leverage spend in the whole system.`],
            ["Build a first-90-day onboarding track", "Churn runs 44% in the first 90 days vs. 18% after two years — an onboarding problem, distinct from disengagement."],
            ["Treat support-ticket spikes as a churn signal", "3+ tickets → 57% churn vs. 21% at zero. Support and retention should share this signal in real time."],
          ].map(([h, p], i) => (
            <Reveal delay={i * 80} key={h} className="cs-rec">
              <div className="cs-rec-idx">{String(i + 1).padStart(2, "0")}</div>
              <div className="cs-rec-body">
                <h4>{h}</h4>
                <p>{p}</p>
              </div>
              <div className="cs-rec-line" />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============== 06 STACK & LIMITS ============== */}
      <section className="cs-sec cs-sec-close">
        <Reveal>
          <div className="cs-marker">06 — Honesty about the build</div>
          <div className="cs-close-grid">
            <div>
              <h3 className="cs-close-h">Data</h3>
              <p className="cs-muted">A modeled dataset simulating a mid-sized streaming service — generated with a
                noisy, multi-factor process, not hand-set rules, then loaded into PostgreSQL.</p>
            </div>
            <div>
              <h3 className="cs-close-h">Analysis</h3>
              <p className="cs-muted">SQL for aggregation, scikit-learn for the model (0.863 AUC, 82.4% accuracy —
                strong, not suspiciously perfect). Ask Signal turns plain English into real SQL and answers only
                from what the query returns.</p>
            </div>
            <div>
              <h3 className="cs-close-h">What real data adds</h3>
              <p className="cs-muted">Billing events (often the strongest churn signal), support-transcript
                sentiment, and a longer window for a true survival model instead of a single snapshot.</p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120} className="cs-signoff">
          <div className="cs-signoff-name">Built by Kanishka Singh</div>
          <button className="cs-btn cs-btn-primary" onClick={onExplore}>
            Explore the live dashboard <span className="cs-btn-arrow">→</span>
          </button>
        </Reveal>
      </section>
    </div>
  );
}

/* ================================================================== *
 * Scoped styles
 * ================================================================== */
const CS_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

.cs-root{
  --bg:#0C0F1A; --bg-2:#0F1322; --paper:#F4F2EC; --ink:#4C6EF5; --ink-soft:#7B93FF;
  --risk:#F0517A; --text:#E8EAF2; --text-dim:#9AA1BC;
  --text-faint:#646C8C; --line:#242A3D; --line-soft:#1B2032;
  background:
    radial-gradient(120% 80% at 82% -10%, rgba(76,110,245,.14), transparent 60%),
    radial-gradient(90% 60% at 0% 8%, rgba(240,81,122,.06), transparent 55%),
    var(--bg);
  color:var(--text);
  font-family:'Space Grotesk',system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
  overflow-x:hidden;
}
.cs-root *{box-sizing:border-box;}

/* reveal */
.cs-reveal{opacity:0; transform:translateY(22px); transition:opacity .7s cubic-bezier(.2,.7,.2,1), transform .7s cubic-bezier(.2,.7,.2,1);}
.cs-reveal.cs-in{opacity:1; transform:none;}
@media (prefers-reduced-motion: reduce){ .cs-reveal{opacity:1; transform:none; transition:none;} }

/* ---------- HERO ---------- */
.cs-hero{max-width:1180px; margin:0 auto; padding:88px 40px 0;}
.cs-hero-grid{display:grid; grid-template-columns:1.05fr .95fr; gap:56px; align-items:center;}
.cs-eyebrow{display:inline-flex; align-items:center; gap:9px; font-family:'JetBrains Mono',monospace; font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-soft); margin-bottom:26px;}
.cs-eyebrow-dot{width:7px; height:7px; border-radius:50%; background:var(--ink); box-shadow:0 0 0 4px rgba(76,110,245,.18); animation:cs-pulse 2.6s ease-in-out infinite;}
@keyframes cs-pulse{0%,100%{box-shadow:0 0 0 3px rgba(76,110,245,.20)} 50%{box-shadow:0 0 0 7px rgba(76,110,245,0)}}
.cs-h1{font-family:'Newsreader',serif; font-weight:500; font-size:clamp(38px,5vw,62px); line-height:1.04; letter-spacing:-.015em; margin:0 0 24px;}
.cs-h1-accent{font-style:italic; color:var(--ink-soft); position:relative; white-space:nowrap;}
.cs-lede{font-size:17.5px; line-height:1.6; color:var(--text-dim); max-width:30em; margin:0 0 34px;}
.cs-hero-cta{display:flex; gap:14px; flex-wrap:wrap;}

.cs-btn{display:inline-flex; align-items:center; gap:9px; font-family:'Space Grotesk',sans-serif; font-weight:600; font-size:14.5px; padding:13px 22px; border-radius:12px; cursor:pointer; border:1px solid transparent; transition:transform .18s cubic-bezier(.2,.7,.2,1), box-shadow .25s, background .25s, border-color .25s; text-decoration:none;}
.cs-btn:active{transform:translateY(1px) scale(.99);}
.cs-btn-primary{background:linear-gradient(180deg,var(--ink-soft),var(--ink)); color:#fff; box-shadow:0 6px 20px -6px rgba(76,110,245,.6), inset 0 1px 0 rgba(255,255,255,.25);}
.cs-btn-primary:hover{transform:translateY(-2px); box-shadow:0 12px 30px -8px rgba(76,110,245,.7), inset 0 1px 0 rgba(255,255,255,.3);}
.cs-btn-arrow{transition:transform .22s;}
.cs-btn-primary:hover .cs-btn-arrow{transform:translateX(4px);}
.cs-btn-ghost{background:rgba(255,255,255,.03); border-color:var(--line); color:var(--text-dim); backdrop-filter:blur(6px);}
.cs-btn-ghost:hover{border-color:var(--ink); color:var(--text); transform:translateY(-2px);}

/* hero motif */
.cs-hero-motif{will-change:transform;}
.cs-decay{position:relative;}
.cs-decay svg{width:100%; height:auto; display:block; overflow:visible;}
.cs-dot{transform-box:fill-box; transform-origin:center;}
.cs-dot-live{fill:var(--ink); animation:cs-fadein .5s both;}
.cs-dot-lost{fill:#39405C; animation:cs-fadein .5s both;}
@keyframes cs-fadein{from{opacity:0; transform:scale(.2)} to{opacity:calc(.35 + var(--surv,.5) * .65); transform:scale(1)}}
.cs-decay-line{fill:none; stroke:var(--risk); stroke-width:1.5; stroke-dasharray:4 5; opacity:.5;}
.cs-decay-tags{display:flex; justify-content:space-between; margin-top:16px; font-family:'JetBrains Mono',monospace; font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--text-faint);}
.cs-decay-tags .cs-risk-tag{color:var(--risk);}

/* ribbon */
.cs-ribbon{display:grid; grid-template-columns:repeat(5,1fr); gap:0; margin-top:64px; border-top:1px solid var(--line); border-bottom:1px solid var(--line);}
.cs-ribbon-cell{padding:22px 20px; border-right:1px solid var(--line-soft);}
.cs-ribbon-cell:last-child{border-right:none;}
.cs-ribbon-v{font-family:'Newsreader',serif; font-size:27px; font-weight:500; color:var(--text); letter-spacing:-.01em;}
.cs-ribbon-stack{font-family:'JetBrains Mono',monospace; font-size:12.5px; color:var(--ink-soft); font-weight:500;}
.cs-ribbon-k{font-family:'JetBrains Mono',monospace; font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--text-faint); margin-top:8px;}

/* ---------- SECTIONS ---------- */
.cs-sec{max-width:1180px; margin:0 auto; padding:96px 40px;}
.cs-marker{font-family:'JetBrains Mono',monospace; font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-soft); margin-bottom:26px; display:flex; align-items:center; gap:12px;}
.cs-marker::before{content:''; width:26px; height:1px; background:var(--ink);}
.cs-marker-invert{color:var(--ink-soft);}
.cs-h2{font-family:'Newsreader',serif; font-weight:500; font-size:clamp(27px,3.4vw,40px); line-height:1.14; letter-spacing:-.012em; margin:0 0 22px; max-width:16em;}
.cs-h2 em{font-style:italic; color:var(--ink-soft);}
.cs-h2-wide{max-width:20em;}
.cs-p{font-size:16px; line-height:1.68; color:var(--text-dim); margin:0 0 16px;}
.cs-p-narrow{max-width:34em;}
.cs-muted{color:var(--text-dim);}
.cs-small{font-size:13.5px;}
.cs-stat-inline{color:var(--ink-soft); font-weight:600; font-family:'JetBrains Mono',monospace;}

/* 01 asymmetric question */
.cs-question-grid{display:grid; grid-template-columns:1.1fr .9fr; gap:48px; align-items:start;}
.cs-question-body p{font-size:16px; line-height:1.7; color:var(--text-dim); margin:0 0 16px;}
.cs-question-body p:first-child{color:var(--text);}

/* 02 parity */
.cs-parity{display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin:32px 0 30px;}
.cs-parity-item{padding:22px; border:1px solid var(--line); border-radius:16px; background:linear-gradient(180deg, rgba(255,255,255,.02), transparent); transition:border-color .3s, transform .3s;}
.cs-parity-item:hover{border-color:var(--ink); transform:translateY(-3px);}
.cs-parity-label{font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--text-faint); margin-bottom:14px;}
.cs-parity-range{font-family:'Newsreader',serif; font-size:34px; font-weight:500; color:var(--text); line-height:1;}
.cs-parity-range span{color:var(--text-faint); margin:0 4px;}
.cs-parity-range i{font-style:normal; font-size:18px; color:var(--text-dim); margin-left:2px;}
.cs-parity-bar{height:4px; background:var(--line); border-radius:3px; margin:16px 0 8px; overflow:hidden;}
.cs-parity-bar span{display:block; height:100%; background:var(--text-faint); border-radius:3px;}
.cs-parity-spread{font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--text-faint);}

/* 03 dark band */
.cs-sec-dark{max-width:none; background:linear-gradient(180deg, var(--bg-2), var(--bg)); border-top:1px solid var(--line); border-bottom:1px solid var(--line);}
.cs-sec-dark > *{max-width:1180px; margin-left:auto; margin-right:auto;}
.cs-metrics{display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin:34px 0;}
.cs-metric{padding:26px 24px; border:1px solid var(--line); border-radius:16px; background:rgba(255,255,255,.015); transition:transform .3s, border-color .3s, box-shadow .3s;}
.cs-metric:hover{transform:translateY(-4px); border-color:var(--ink); box-shadow:0 18px 40px -20px rgba(76,110,245,.5);}
.cs-metric-v{font-family:'Newsreader',serif; font-size:38px; font-weight:500; color:var(--ink-soft); line-height:1;}
.cs-metric-k{font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--text-faint); margin-top:12px;}
.cs-charts-2{display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:8px;}

.cs-panel{padding:24px; border:1px solid var(--line); border-radius:18px; background:linear-gradient(180deg, rgba(255,255,255,.025), rgba(255,255,255,.005)); box-shadow:0 24px 60px -40px rgba(0,0,0,.8); transition:border-color .3s, transform .3s;}
.cs-panel:hover{border-color:rgba(76,110,245,.5);}
.cs-panel-head{display:flex; flex-direction:column; gap:4px; margin-bottom:16px;}
.cs-panel-title{font-family:'Space Grotesk',sans-serif; font-weight:600; font-size:14.5px; color:var(--text);}
.cs-panel-note{font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--text-faint);}

.cs-tip{display:flex; flex-direction:column; gap:2px; background:#161B2C; border:1px solid var(--line); border-radius:9px; padding:8px 12px;}
.cs-tip-k{font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--text-faint);}
.cs-tip-v{font-family:'Newsreader',serif; font-size:17px; color:var(--text);}

/* 04 finding */
.cs-sec-finding{padding-top:104px; padding-bottom:104px;}
.cs-h2-lead{max-width:15em; font-size:clamp(30px,4vw,48px);}
.cs-big-accent{color:var(--ink-soft); font-style:italic;}
.cs-big-risk{color:var(--risk); font-style:italic;}
.cs-finding-grid{display:grid; grid-template-columns:1.4fr 1fr; gap:32px; align-items:start; margin-top:12px;}
.cs-panel-lg{padding:28px;}
.cs-finding-aside p{font-size:15.5px; line-height:1.66; color:var(--text-dim); margin:0 0 20px;}
.cs-pull{border-left:2px solid var(--risk); padding:6px 0 6px 22px; margin:24px 0;}
.cs-pull-fig{font-family:'Newsreader',serif; font-size:58px; font-weight:500; color:var(--risk); line-height:.95; letter-spacing:-.02em;}
.cs-pull-cap{font-size:14.5px; line-height:1.55; color:var(--text-dim); margin-top:10px; max-width:24em;}

/* 05 recommendations */
.cs-recs{margin-top:34px; border-top:1px solid var(--line);}
.cs-rec{position:relative; display:grid; grid-template-columns:auto 1fr; gap:28px; padding:30px 0; border-bottom:1px solid var(--line); align-items:baseline; transition:padding-left .35s cubic-bezier(.2,.7,.2,1);}
.cs-rec:hover{padding-left:14px;}
.cs-rec-idx{font-family:'JetBrains Mono',monospace; font-size:13px; color:var(--ink-soft); padding-top:5px;}
.cs-rec-body h4{font-family:'Newsreader',serif; font-weight:500; font-size:22px; color:var(--text); margin:0 0 8px; letter-spacing:-.01em;}
.cs-rec-body p{font-size:15px; line-height:1.6; color:var(--text-dim); margin:0; max-width:44em;}
.cs-rec-line{position:absolute; left:0; bottom:-1px; height:1px; width:0; background:var(--ink); transition:width .5s cubic-bezier(.2,.7,.2,1);}
.cs-rec:hover .cs-rec-line{width:100%;}

/* 06 close */
.cs-sec-close{padding-bottom:120px;}
.cs-close-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:36px; margin-top:8px;}
.cs-close-h{font-family:'JetBrains Mono',monospace; font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-soft); margin:0 0 14px; padding-bottom:12px; border-bottom:1px solid var(--line);}
.cs-close-grid p{font-size:15px; line-height:1.66; margin:0;}
.cs-signoff{display:flex; align-items:center; justify-content:space-between; gap:24px; margin-top:64px; padding-top:34px; border-top:1px solid var(--line); flex-wrap:wrap;}
.cs-signoff-name{font-family:'Newsreader',serif; font-style:italic; font-size:20px; color:var(--text-dim);}

/* ---------- responsive ---------- */
@media (max-width:920px){
  .cs-hero-grid{grid-template-columns:1fr; gap:40px;}
  .cs-hero-motif{order:-1; max-width:440px;}
  .cs-ribbon{grid-template-columns:repeat(2,1fr);}
  .cs-ribbon-cell:nth-child(2n){border-right:none;}
  .cs-ribbon-cell{border-bottom:1px solid var(--line-soft);}
  .cs-question-grid{grid-template-columns:1fr; gap:24px;}
  .cs-parity{grid-template-columns:1fr;}
  .cs-metrics{grid-template-columns:1fr 1fr;}
  .cs-charts-2{grid-template-columns:1fr;}
  .cs-finding-grid{grid-template-columns:1fr;}
  .cs-close-grid{grid-template-columns:1fr;}
}
@media (max-width:560px){
  .cs-hero{padding:60px 22px 0;} .cs-sec{padding:64px 22px;}
  .cs-ribbon{grid-template-columns:1fr;} .cs-ribbon-cell{border-right:none; border-bottom:1px solid var(--line-soft);}
  .cs-metrics{grid-template-columns:1fr 1fr;}
  .cs-signoff{flex-direction:column; align-items:flex-start;}
}
`;
