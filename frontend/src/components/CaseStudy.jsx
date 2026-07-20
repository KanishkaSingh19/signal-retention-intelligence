import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, Tooltip } from "recharts";
import data from "../data/data.json";

const COLORS = { amber: "#E8A33D", teal: "#56C2B4", rose: "#FF7A82", grid: "#20242F" };

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1C202C", border: "1px solid #282D3C", borderRadius: 8, padding: "8px 12px", fontFamily: "IBM Plex Mono", fontSize: 12 }}>
      <div style={{ color: "#8D91A3" }}>{label}</div>
      <div style={{ color: "#EFEBE0" }}>{payload[0].value}%</div>
    </div>
  );
}

function BandChart({ obj, color, max = 60 }) {
  const rows = Object.entries(obj).map(([k, v]) => ({ name: k, value: v }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "#8D91A3", fontSize: 10.5, fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: COLORS.grid }} tickLine={false} />
        <YAxis domain={[0, max]} tick={{ fill: "#8D91A3", fontSize: 10.5, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,.03)" }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} fill={color} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DecileChart() {
  const rows = data.risk_deciles.map((d) => ({ name: "D" + d.decile, value: d.churn_rate, decile: d.decile }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: "#8D91A3", fontSize: 10.5, fontFamily: "IBM Plex Mono" }}
          axisLine={{ stroke: COLORS.grid }}
          tickLine={false}
          label={{ value: "Predicted risk decile (1=lowest, 10=highest)", position: "insideBottom", offset: -2, fill: "#8D91A3", fontSize: 11 }}
        />
        <YAxis domain={[0, 100]} tick={{ fill: "#8D91A3", fontSize: 10.5, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,.03)" }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {rows.map((r, i) => (
            <Cell key={i} fill={r.decile >= 9 ? COLORS.rose : r.decile <= 3 ? COLORS.teal : COLORS.amber} />
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

  return (
    <div className="wrap">
      <section className="hero">
        <div className="eyebrow">Product Analytics Case Study</div>
        <h1>
          The riskiest <em>20%</em> of users account for over half of all churn — here's how to find them before they leave.
        </h1>
        <p className="lede">
          A streaming platform wanted a churn model it could actually act on, not just a KPI dashboard. This
          is how a behavioral risk score outperformed demographic segmentation, what the model gets wrong, and
          what I'd do next with more data.
        </p>
        <div className="meta-row">
          <div className="meta-item"><div className="k">Users modeled</div><div className="v">25,000</div></div>
          <div className="meta-item"><div className="k">Watch sessions</div><div className="v">100,455</div></div>
          <div className="meta-item"><div className="k">Ratings</div><div className="v">40,131</div></div>
          <div className="meta-item"><div className="k">Titles</div><div className="v">500</div></div>
          <div className="meta-item"><div className="k">Stack</div><div className="v">SQL · Python · React · OpenAI</div></div>
        </div>
      </section>

      <section className="section">
        <div className="section-label">01 — The Question</div>
        <h2>A quarter of users churn every cycle. Which quarter matters more than the average.</h2>
        <p>
          Base churn rate across the platform sits at <span className="hl">{data.churn_rate}%</span>. Averages
          like that are useless operationally — a retention team can't target "everyone." The real question:
          can a small, well-targeted slice of the user base be identified <em>before</em> they leave, accurately
          enough to be worth acting on?
        </p>
        <p>
          I modeled the problem across four linked tables — users, watch history, ratings, and content metadata
          — using SQL (a real PostgreSQL database, not just pandas) for aggregation and segmentation, Python
          (pandas + scikit-learn) for feature engineering and the churn model, React for this dashboard, and a
          OpenAI-powered natural-language SQL agent ("Ask Signal") so anyone can query the data without writing
          SQL themselves.
        </p>
      </section>

      <section className="section">
        <div className="section-label">02 — What Doesn't Predict Churn (Much)</div>
        <h2>Demographics are close to noise. Behavior isn't.</h2>
        <p>Country, subscription tier, and age band all sit within a couple of points of the base rate:</p>
        <div className="parity-row">
          {parity.map(([label, obj]) => {
            const vals = Object.values(obj);
            return (
              <div className="parity-chip" key={label}>
                {label}: <b>{Math.min(...vals).toFixed(1)}% – {Math.max(...vals).toFixed(1)}%</b> range
              </div>
            );
          })}
        </div>
        <p>
          Favorite genre shows a wider raw spread, but that gap mostly <strong>disappears in the multivariate
          model</strong> — genre coefficients shrink to near-zero once watch time and recency are controlled
          for. The likely explanation: genre preference is a weak proxy for how much someone actually watches,
          not a cause of churn in its own right. That's a classic confounding pattern worth checking before
          trusting any single-variable chart.
        </p>
      </section>

      <section className="section">
        <div className="section-label">03 — What Actually Predicts Churn</div>
        <h2>Two behavioral signals, plus a support-ticket and tenure effect.</h2>
        <p>
          A logistic regression found <strong>days since last login</strong> and <strong>cumulative watch
          time</strong> dominating every other coefficient by roughly 5-7x. Two secondary signals also
          mattered: support tickets and account tenure.
        </p>
        <div className="metric-strip">
          <div className="m"><div className="mv">{data.model_auc}</div><div className="ml">ROC-AUC</div></div>
          <div className="m"><div className="mv">{data.model_accuracy}%</div><div className="ml">Accuracy</div></div>
          <div className="m"><div className="mv">{data.model_precision}%</div><div className="ml">Precision</div></div>
          <div className="m"><div className="mv">{data.model_recall}%</div><div className="ml">Recall</div></div>
        </div>
        <div className="card">
          <div className="ctitle">Churn rate by account tenure</div>
          <div className="csub">New accounts are the highest-risk segment — an onboarding problem, not just disengagement</div>
          <BandChart obj={data.churn_by_tenure_band} color={COLORS.rose} max={50} />
        </div>
        <div className="card">
          <div className="ctitle">Churn rate by support ticket count</div>
          <div className="csub">Each additional ticket roughly doubles churn likelihood</div>
          <BandChart obj={data.churn_by_support_tickets} color={COLORS.amber} max={65} />
        </div>
      </section>

      <section className="section">
        <div className="section-label">04 — The Finding</div>
        <h2>Ranking beats thresholding. The top 20% of scored users capture 55% of all churn.</h2>
        <p>
          Rather than pick a single cutoff on any one metric, every user was scored with the trained model and
          sorted into risk deciles — a clean, monotonic lift curve, and a much more honest picture than a hard
          threshold would give:
        </p>
        <div className="card">
          <div className="ctitle">Churn rate by predicted risk decile</div>
          <div className="csub">Decile 1 = lowest 10% of predicted risk · Decile 10 = highest 10%</div>
          <DecileChart />
        </div>
        <div className="callout rose">
          <p>
            The top 2 deciles — <strong className="hl-rose">20% of the user base</strong> — contain{" "}
            <strong className="hl-rose">{data.top2decile_capture_pct}% of everyone who actually churns</strong>.
            Targeting retention spend there instead of the full base cuts outreach volume by 5x while still
            reaching over half of at-risk users.
          </p>
        </div>
        <p>
          Recall sits at {data.model_recall}% at the model's default threshold — meaning it misses about half
          of churners if used as a binary yes/no classifier. The decile/lift view sidesteps that limitation:
          instead of asking the model for a verdict, it asks for a <em>ranking</em>, and spends the retention
          budget top-down until the budget runs out.
        </p>
      </section>

      <section className="section">
        <div className="section-label">05 — Recommendations</div>
        <h2>Spend the retention budget on rank, not on rules.</h2>
        <div className="rec-list">
          <div className="rec-item">
            <div className="rec-num">01</div>
            <div><h4>Route deciles 9-10 into a proactive win-back flow</h4><p>20% of users capturing 55% of churn — the highest-leverage segment for retention spend.</p></div>
          </div>
          <div className="rec-item">
            <div className="rec-num">02</div>
            <div><h4>Build a first-90-day onboarding track</h4><p>Churn is 44% in the first 90 days vs. 18% after 2 years — a distinct problem from general disengagement.</p></div>
          </div>
          <div className="rec-item">
            <div className="rec-num">03</div>
            <div><h4>Flag support-ticket spikes as a retention signal</h4><p>Users with 3+ tickets churn at 57% vs. 21% for zero tickets — support and retention teams should share this signal.</p></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-label">06 — Stack &amp; Limitations</div>
        <h2>How this was built, and what it can't tell you.</h2>
        <p>
          <strong>Data:</strong> a modeled dataset simulating a mid-sized streaming service, generated with a
          noisy, multi-factor process rather than a hand-set rule, loaded into a real PostgreSQL database.
        </p>
        <p>
          <strong>Analysis:</strong> SQL for aggregation, Python/scikit-learn for the churn model (0.863 AUC,
          82.4% accuracy — strong but not suspiciously perfect). <strong>Ask Signal</strong> — the chat tab
          above — lets you ask questions in plain English; OpenAI writes and runs real SQL against this exact
          database and answers only from what the query returns, not from memory.
        </p>
        <p>
          <strong>What I'd add with real data:</strong> billing/payment events (often the strongest churn
          signal and not modeled here), support transcript sentiment, and a longer observation window for a
          true survival model instead of a single-snapshot classifier.
        </p>
      </section>

      <div className="footer">
        <p>Built by Kanishka Singh · SQL / Python / React / OpenAI</p>
        <button className="switch-btn" onClick={onExplore}>Explore the live dashboard →</button>
      </div>
    </div>
  );
}
