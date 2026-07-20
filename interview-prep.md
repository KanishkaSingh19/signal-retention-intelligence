# Interview Prep — Product Analytics & Retention Intelligence Platform

This is a study guide, not a script. Read it, then explain each section out
loud in your own words until you don't need the page. Interviewers can tell
the difference between "I built this" and "I memorized a description of
this."

---

## 1. The 30-second pitch (memorize the shape, not the words)

"I built an end-to-end churn analytics project on a modeled streaming
platform — 25K users, 100K+ sessions. Instead of just reporting a churn
rate, I trained a model to rank users by risk and found that the riskiest
20% of users account for 55% of all churn. That's the actionable version of
the finding — a retention team can target a fifth of the base and still
catch the majority of people about to leave."

Practice saying this in under 30 seconds without reading it.

---

## 2. Questions about the dataset

**Q: Is this real data?**
No — it's a modeled/synthetic dataset built to simulate a subscription
streaming service. Say this immediately and confidently; don't wait to be
caught. Then pivot to what's transferable: "The dataset is synthetic, but I
built the generator myself with realistic, noisy relationships rather than
clean rules, and the analysis method — feature engineering, driver
modeling, risk ranking — is identical to what I'd do on real production
data."

**Q: Why did you build your own dataset instead of using a real one?**
Two reasons: (1) real company churn data isn't publicly available at this
granularity, and (2) building the generator myself forced me to think
explicitly about what actually drives churn and how those drivers should
statistically relate to each other — which is good practice for feature
engineering either way.

**Q: How did you make sure the synthetic data was realistic and not just
random?**
Three things, concretely:
1. Churn is generated from a noisy logistic function of multiple weighted
   signals (recency, engagement, tenure, support tickets) plus random
   individual-level noise — not a hard threshold. That's why my trained
   model recovers it at 86% AUC, not 100%.
2. The tables are internally consistent: a user's favorite genre is
   *derived* from what they actually watched, not assigned independently.
   No watch session happens after a user's last login or before signup.
3. I gave users a latent "engagement type" (casual / regular / power) that
   drives watch time, recency, and churn together, instead of drawing each
   column independently — which is closer to how real user behavior
   actually correlates.

**Q: What would you change with real data?**
Add billing/payment events (failed charges are usually the single
strongest churn predictor in real subscription businesses and aren't in
my dataset), customer support transcript sentiment, and a longer
observation window so I could build a survival/time-to-event model instead
of a single-snapshot classifier.

---

## 3. Questions about the method

**Q: Why logistic regression instead of a more complex model (XGBoost,
random forest)?**
Two reasons: interpretability and honesty about the use case. For a
retention team, I need to explain *why* someone is at risk, not just flag
them — logistic regression coefficients are directly interpretable ("a
1-SD increase in days-since-login increases churn odds by X"). I'd
consider a gradient-boosted model if the goal were pure predictive
performance and interpretability were handled separately (e.g., with SHAP
values), but for a first pass with a clear, dominant signal, the simpler
model was the right tool — and it already reaches 0.863 AUC, so there
wasn't an obvious accuracy gap to justify the added complexity.

**Q: Walk me through your feature engineering.**
Core features: age, tenure (days since signup), cumulative watch hours,
days since last login, support ticket count, device count, subscription
tier, favorite genre, and country. I standardized continuous features
before fitting (z-scores) so coefficients are comparable in magnitude, and
one-hot encoded categoricals with drop_first to avoid the dummy variable
trap.

**Q: Your model has 82% accuracy — is that good?**
Accuracy alone is misleading with a 27% base churn rate, because a model
that always predicts "no churn" would already be ~73% accurate. That's why
I also report AUC (0.863, which measures ranking quality independent of
threshold) and precision/recall (75.7% / 50.9%) — those are the numbers
that actually tell you whether the model is useful.

**Q: What does 75.7% precision and 50.9% recall mean here, in plain
terms?**
At the default classification threshold, when the model says "this user
will churn," it's right about 76% of the time (precision). But it only
catches about 51% of the users who actually do churn (recall) — it misses
roughly half. That's a real limitation, and it's exactly why I didn't
recommend using the model as a binary yes/no flag. Instead, I used it to
*rank* users continuously and let the retention team decide how far down
the list their budget reaches. Ranking sidesteps the threshold problem
entirely.

**Q: What's a lift chart / gains chart, and why did you use one?**
It's a way of showing how much better than random your model's ranking is.
I split users into 10 equal-sized groups (deciles) by predicted risk score
and plotted actual churn rate per decile. If the model had no signal, all
10 deciles would show roughly the same churn rate (~27%). Instead it's
monotonic from ~1% (decile 1) to ~90% (decile 10) — meaning the ranking is
doing real work. The business framing is: "if you can only afford to
contact 20% of users, contact these ones — you'll reach 55% of the people
who were actually going to leave."

**Q: How did you validate the model wasn't overfitting?**
75/25 train/test split, stratified by churn label so both sets have the
same churn rate. AUC and accuracy reported above are on the held-out test
set, not training data. With more time I'd add k-fold cross-validation to
get a confidence interval on those numbers rather than a single point
estimate.

**Q: You found genre had a big raw effect but a small effect in the full
model — explain that.**
That's a confounding pattern. In a simple one-variable crosstab, churn by
genre shows meaningful spread. But once I control for watch time and
recency in the multivariate model, genre's coefficient shrinks to almost
nothing. The likely explanation: genre preference correlates with *how
much* someone watches (which is the real driver), not with churn directly.
This is a good example of why you check multivariate effects before
trusting a single-variable chart — a variable can look predictive purely
because it's correlated with the actual cause.

---

## 4. Questions about business framing

**Q: What would you actually recommend a product/growth team do with
this?**
Three things, in priority order:
1. Build a risk-decile score into the CRM and route the top 20% into a
   proactive win-back flow rather than a blanket campaign.
2. Build a first-90-day onboarding track — new accounts churn at 44% vs.
   18% for 2+ year accounts, which is a distinct problem (onboarding/first
   impression) from general disengagement and needs its own intervention.
3. Route support-ticket spikes to the retention team as a signal, not just
   a support metric — each additional ticket roughly doubles churn odds.

**Q: How would you measure whether your recommendation actually worked?**
Run it as an A/B test: route the top-decile-flagged users to the
intervention (win-back email, incentive, proactive outreach) vs. a
holdout group that gets nothing, then compare realized churn rates between
groups over the following billing cycle. That's the only way to know the
intervention caused a change rather than just correlating with users who
were already more likely to stay for other reasons.

**Q: What's the cost of a false positive here (flagging someone who
wasn't going to churn)?**
Usually low — a retention email or a small discount offer to someone who
was staying anyway is a minor cost. That asymmetry (false positives are
cheap, false negatives are expensive — a churned subscriber is lost
revenue) is actually an argument for favoring recall over precision if the
intervention itself is inexpensive, which is a good follow-up point to
raise if asked how you'd tune the threshold differently.

---

## 5. Questions likely to trip you up — practice these specifically

**Q: If I gave you real data tomorrow, what's the first thing you'd
check?**
Class imbalance (is churn still ~25-30%, or much rarer in reality — real
subscription churn is often single digits monthly, which changes model
choice), missing data patterns (are ratings/sessions missing at random or
systematically for about-to-churn users), and whether "churn" is even
defined consistently (cancelled subscription? stopped logging in? — these
are different labels with different lead times).

**Q: What's a limitation of using login recency as a feature in a live
system (not just this analysis)?**
It's a lagging indicator — by the time someone hasn't logged in for 40
days, they've likely already mentally churned. A production system would
want earlier leading indicators (declining session length trend,
completion rate trend) to catch people before the recency signal even
fires.

**Q: Why is your average watch time only ~3.7 hours total per user? That
seems low for a streaming platform.**
That reflects the underlying session-count calibration I used to keep the
dataset at a realistic ~100K total sessions across 25K users (matching a
believable analytics-project scale) — most users in this simulation are
light or moderate viewers with a smaller share of power users, which is
actually consistent with real engagement distributions on many platforms
(a small fraction of users drive a large share of usage). I'd flag this as
a modeling choice, not claim it's a general fact about streaming behavior.

---

## 6. Questions about the GenAI features (Copilot + Ask Signal)

The project has three AI features, all powered by OpenAI (gpt-4o-mini):
(1) **Ask Signal** — text-to-SQL Q&A; (2) **AI churn explanations** — why a
given user is at risk; (3) **AI win-back emails** — a drafted intervention.
Together: score → explanation → action.

**Q: Walk me through the AI features as a product, not just tech.**
"The ML model produces a churn *score*, but a score alone isn't actionable
for a retention manager. So the AI layer closes that gap: it *explains* why a
specific user is at risk in plain English from their real data, then *drafts*
the win-back email. That's the product — it turns a number into a next
action, which is what a retention team actually needs."

**Q: Walk me through how "Ask Signal" (text-to-SQL) works.**
"The user types a question. I send it to the model with the database schema
and a `run_sql_query` tool. The model writes SQL, my backend validates it and
runs it read-only against Postgres, and the results go back to the model,
which answers from the real rows. It can't invent a number — it has to query
for it, and I can show the exact SQL it ran."

**Q: How do the explanation and email features avoid hallucination?**
"Both pull the user's real record from Postgres first, then pass those
concrete stats to the model as structured context. The model isn't recalling
anything — it's writing from facts I hand it. For the email I also instruct
it not to expose internal metrics like 'churn score' to the customer."

**Q: Why OpenAI / why gpt-4o-mini specifically?**
"For short SQL generation and short text generation, a small model is the
right call: gpt-4o-mini is ~$0.15 per million input tokens, so each request
is a fraction of a cent, and it's more than capable. I'd only reach for a
bigger model if the task needed complex multi-step reasoning. It's a
cost/capability fit decision, not 'use the biggest model.'"

**Q: Public URL + your API key behind it — how do you not get a huge bill?**
"Three layers: a hard spending cap in the OpenAI dashboard (at the cap it
stops serving — it can't overspend), per-IP rate limiting on the AI routes
(`rateLimit.js`), and a Google Cloud budget alert. Plus the model is cheap
enough that the cap is a generous ceiling. The key is a server-side env var —
it never reaches the browser."

**Q: How do you stop the LLM from running a dangerous SQL query?**
A validation layer (`sqlGuard.js`) before execution: read-only SELECT/WITH
only; DDL/DML and admin keywords (INSERT, UPDATE, DELETE, DROP, COPY, GRANT,
etc.) blocked; only the four known tables allowed (so no `pg_catalog` or
`information_schema`); single statement; row cap. Plus the query runs inside a
read-only Postgres transaction, so even if something slipped past the text
check, the database itself rejects any write. I treat the model's output as
untrusted input.

**Q: What if the LLM's SQL query fails or is invalid?**
The error is passed back to the model as a tool result instead of crashing, so
it can read the error and try a corrected query — the debugging loop a person
would do, automated. There's a cap on tool-call rounds so it can't loop
forever.

**Q: What did you containerize and why?**
"The backend has a Dockerfile so the same image runs anywhere — my laptop,
Cloud Run, Render — with config injected via env vars. Build once, run
anywhere, no 'works on my machine.'"

**Q: Walk me through your cloud deployment.**
"Three tiers: managed Postgres on Neon, the containerized Node API on Google
Cloud Run, and the React frontend on Vercel. Cloud Run scales to zero, so it
costs nothing idle. The frontend only knows the backend URL; the OpenAI key
and database URL are backend-only env vars."

**Q: Why PostgreSQL instead of SQLite (or just CSV files)?**
SQLite is a single-file database — great for a quick local demo, but it's
not what production systems use for a multi-user app. Postgres is a real
client-server database: it handles concurrent connections, has richer
types (proper DATE, DOUBLE PRECISION), and is what most companies actually
run. Moving to it made the "queried a Postgres database" claim literally
true and let me use a real connection pool and read-only transactions —
things that don't exist in the SQLite version. I kept a SQLite fallback in
the repo so someone can still run it with zero setup, but Postgres is the
primary path.

**Q: What actually changed when you migrated from SQLite to Postgres?**
Less than you'd think, which is the point — most standard SQL is portable.
The database driver in the backend (`better-sqlite3` → `pg`), which also
meant the query execution went from synchronous to async. Two SQLite-only
date functions (`strftime` → Postgres `to_char`). Column types in the
schema became proper Postgres types. And bulk loading went from row-by-row
inserts to Postgres's `COPY` command, which is much faster for loading a
100K-row table. The analysis queries with window functions and CTEs
(NTILE, RANK, LAG) didn't need changing at all — that syntax is standard.

**Q: You mentioned a read-only transaction — why, on top of the SQL
validator?**
Defense in depth. The `sqlGuard` validator checks the query text before it
runs, but I don't want the whole system's safety to depend on one regex
layer being perfect. Running each query inside `BEGIN TRANSACTION READ
ONLY` means Postgres itself will reject any write, even if a malicious
query somehow passed the text check. Two independent layers, so a gap in
one doesn't compromise the database.


I'd build a test set of question/expected-SQL (or expected-answer) pairs
covering common query patterns, run them through the agent, and check
whether the generated SQL is both syntactically valid and semantically
correct (e.g., correct aggregation, correct filter conditions) — not just
whether it runs without erroring. I'd also want to log a sample of real
user questions in production and periodically review them for cases where
the model picked the wrong table, wrong join, or misinterpreted the
question, the same way you'd audit any ML system in production.

## 7. Questions about the React frontend

**Q: Why did you rebuild the dashboard in React instead of just using the
Power BI / Streamlit version?**
Power BI and Streamlit are great for internal analytics tools, but they
aren't natural fits for something you want to link a recruiter to and
have load instantly with no login. React lets me ship a fast, standalone,
publicly hostable version of the same analysis, and it's also the more
directly transferable skill for a lot of roles that touch product
tooling — building the same dashboard three ways (Power BI, Streamlit,
React) was partly about showing I can adapt the same analysis to
different delivery contexts.

**Q: What's your state management approach — did you use Redux or
similar?**
No — the app is small enough that React's built-in `useState` is
sufficient (which view tab is active, chat message history, loading
state). I'd reach for something like Zustand or Redux only if the state
started getting shared across many disconnected components or needed to
persist/sync in more complex ways than this app requires. Adding a state
management library here would be over-engineering for the actual
complexity of the app.

**Q: How is the dashboard data getting into the React app — an API call
every time?**
The dashboard charts read from a bundled `data.json` (computed once by
the Python analysis pipeline and copied into the frontend at build time)
rather than hitting an API on every page load — it's precomputed
aggregate data that doesn't change per-request, so there's no reason to
recompute it live. Ask Signal is different: it genuinely needs a live
backend round trip per question, since the question isn't known in
advance.

---

## 8. Numbers to have cold (don't fumble these)

| Metric | Value |
|---|---|
| Users / sessions / ratings / titles | 25,000 / 100,455 / 40,131 / 500 |
| Base churn rate | 26.9% |
| Model AUC | 0.863 |
| Model accuracy | 82.4% |
| Model precision / recall | 75.7% / 50.9% |
| Top 2 deciles capture | 55% of all churn (in 20% of users) |
| New account (0-90d) churn | 44.0% |
| 2yr+ account churn | 18.3% |
| Support tickets: 0 vs 3+ churn | 21.2% vs 57.5% |
| Demographic churn spread (country/age) | <2 points |

---

## 9. If they ask you to extend it live (whiteboard/live-coding round)

Likely asks and how to approach them out loud:

- **"Add a new feature to the model."** Talk through: what's the
  hypothesis (e.g., "number of distinct genres watched" as a proxy for
  content satisfaction), how you'd engineer it from `watch_history` (groupby
  user_id, nunique on genre), and how you'd check if it adds signal
  (compare AUC with/without, check the coefficient sign and magnitude).
- **"How would you turn this into a SQL query?"** Be ready to sketch: a
  CTE joining users to an aggregated watch_history (sessions, hours,
  last watch date), then a case/when bucketing into risk tiers — even
  pseudocode is fine, the interviewer is checking your JOIN and
  aggregation logic, not syntax perfection.
- **"How would you present the top finding to a non-technical exec in one
  slide?"** One number, one chart: "20% of users → 55% of churn" as a
  headline, with the decile bar chart underneath. Skip the AUC/precision
  talk for that audience — save it for when they ask "how confident are
  you in this."
