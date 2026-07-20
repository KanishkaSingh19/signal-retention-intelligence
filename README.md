# Signal — Product Analytics & Retention Intelligence

A full-stack churn analytics **product** for a modeled subscription
streaming platform. It combines a real PostgreSQL database, a Python-trained
churn model, a React dashboard, and an **AI Retention Copilot** (OpenAI)
that:

1. **Ask Signal** — answers plain-English questions by writing and running
   real SQL against the database (text-to-SQL, grounded in actual rows).
2. **AI churn explanations** — for any high-risk user, reads their real
   stats and explains *why* they're likely to churn.
3. **AI win-back emails** — drafts a personalized retention email for that
   user based on their actual profile.

Together that's the product story: an ML model **scores** churn risk, and an
LLM layer **explains** each at-risk user and **drafts the intervention** —
score → reason → action.

**Live site:** [add your hosted frontend link here]

## The headline finding

Base churn is 26.9%, but a trained risk model can rank users by likelihood
of churning — and that ranking is highly concentrated. **The top 20% of
scored users capture 55% of all churn.** A retention team can cut outreach
volume by 5x and still reach the majority of at-risk users.

Full write-up, model limitations, and recommendations are in the Case
Study tab of the live site.

## Architecture

```
┌─────────────┐      ┌──────────────────────┐      ┌─────────────────┐
│   React      │ ---> │   Express backend     │ ---> │   PostgreSQL     │
│  (Vite)      │      │   /api/stats          │      │   (Neon/local)   │
│              │      │   /api/ask (text→SQL) │      └─────────────────┘
│ Case Study   │      │   /api/explain-user   │              ▲
│ Dashboard    │      │   /api/winback-email  │              │
│ Copilot      │ <--- │   /api/high-risk-users│──────────────┘
│ Ask Signal   │      │        │              │   real SQL (read-only)
└─────────────┘      │        ▼              │
                     │   OpenAI (gpt-4o-mini)│
                     └──────────────────────┘
```

- **Data layer:** `sql/generate_data.py` builds a realistic, internally
  consistent synthetic dataset (see "Why this dataset" below).
  `sql/load_pg.py` creates the schema (`sql/schema.sql`) and bulk-loads
  the CSVs into PostgreSQL via `COPY`. (`sql/build_db.py` is also
  included as a zero-setup SQLite fallback for quick local runs.)
- **Analysis layer:** `data/analyze.py` — reads from Postgres (or the
  CSVs), runs SQL-style aggregation, a logistic regression churn model
  (scikit-learn), and the risk-decile ranking, exported to
  `data/data.json`.
- **Backend:** `backend/server.js` (Node/Express + `pg` + OpenAI) — serves
  dashboard stats and the high-risk user list, and exposes three AI routes:
  `/api/ask` (text-to-SQL agent — the model writes SQL, the backend
  validates it via `sqlGuard.js` and runs it in a read-only transaction,
  the model answers from the real rows), `/api/explain-user` (churn-risk
  explanation from a user's real stats), and `/api/winback-email`
  (personalized retention email). All AI routes are rate-limited
  (`rateLimit.js`).
- **Frontend:** `frontend/` (React + Vite) — Case Study, Dashboard (4 tabs,
  Recharts), **Copilot** (high-risk list → AI explanation → win-back email),
  and Ask Signal (the text-to-SQL chat).
- **BI layer:** `bi-dashboards/` — a build guide for a Power BI report
  connected live to the Postgres database (DAX measures for churn rate,
  retention, churn-vs-benchmark, and risk deciles), plus a Tableau guide
  for the companion Swiggy Instamart project.

## Why this dataset isn't just random noise

A naive synthetic generator draws every column independently, which
produces charts that are technically "data" but analytically
meaningless. This one avoids that:

- Churn is a **noisy logistic function** of multiple weighted signals
  (recency, engagement, tenure, support tickets, small demographic
  effects) plus unobserved-heterogeneity noise — not a hand-set
  threshold. A trained model recovers it at 0.863 AUC / 82.4% accuracy,
  strong but realistically imperfect.
- **Tables are cross-consistent.** Favorite genre is derived from actual
  watch behavior, not assigned independently. No watch session falls
  outside a user's signup-to-last-login window.
- **Individual heterogeneity** (a latent engagement "type") drives watch
  time, recency, and churn together, the way real behavior correlates.

## Why NL2SQL instead of a generic chatbot

"Ask Signal" doesn't answer from the model's memory or from a document
store — it makes the model write and execute real SQL against the actual
database every time, then answer only from what the query returns. That
matters for two reasons worth being able to explain:

1. **Grounding.** The model can't hallucinate a churn rate — it has to
   query for it. If a question can't be answered from the schema, it says
   so instead of guessing.
2. **Guardrails matter.** LLM-generated SQL is untrusted input.
   `sqlGuard.js` enforces: read-only statements only (SELECT/WITH), no
   DDL/DML keywords, no access to system tables, single statement only,
   and an automatic row-count cap. This is the same category of problem
   as sanitizing user input — just applied to model output.

## Run it locally

Prerequisite: a running PostgreSQL server (v13+). On macOS the easiest
option is [Postgres.app](https://postgresapp.com/); on Linux, the
`postgresql` package; or Docker: `docker run -e POSTGRES_PASSWORD=postgres
-p 5432:5432 postgres`.

```bash
# 1. Load the database
cd sql
pip install -r requirements.txt
createdb retention            # or: psql -c "CREATE DATABASE retention;"
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/retention"
python3 generate_data.py      # optional -- CSVs already included
python3 load_pg.py            # creates schema + bulk-loads the CSVs via COPY

# (optional zero-setup alternative, no Postgres needed:
#   python3 build_db.py   -> builds a local SQLite retention.db instead)

# 2. Start the backend
cd ../backend
npm install
cp .env.example .env          # add OPENAI_API_KEY and DATABASE_URL
npm start                     # http://localhost:3001

# 3. Start the frontend (separate terminal)
cd ../frontend
npm install
cp .env.example .env          # points at the backend, defaults are fine locally
npm run dev                   # http://localhost:5173
```

The AI features — **Copilot** (churn explanations + win-back emails) and
**Ask Signal** (text-to-SQL) — require `OPENAI_API_KEY` and `DATABASE_URL`
in `backend/.env`. The Case Study and Dashboard read the precomputed
`data.json` and work without either.

For full cloud deployment (Neon + Cloud Run + Vercel) with $0 billing
safety, see **`DEPLOYMENT.md`**.

## Deploying

See **`DEPLOYMENT.md`** for the complete step-by-step (managed Postgres on
Neon, containerized backend on Google Cloud Run via the included
`backend/Dockerfile`, React frontend on Vercel, and — importantly — how to
set hard spending caps on both OpenAI and Google Cloud first). Quick summary:

- **Database:** a managed Postgres instance (Neon, Supabase, Railway, RDS,
  etc.). Run `load_pg.py` against it once with its `DATABASE_URL`.
- **Frontend:** `npm run build` in `frontend/`, deploy the `dist/` folder
  to Vercel/Netlify. Set `VITE_API_BASE` to your deployed backend URL.
- **Backend:** deploy `backend/` to Render/Railway/Fly.io/a small VPS —
  anywhere that can run a persistent Node process. Set `OPENAI_API_KEY`
  and `DATABASE_URL` as environment variables there, never in frontend
  code.

## Stack

| Layer | Tools |
|---|---|
| Data generation | Python (NumPy, pandas) |
| Database | PostgreSQL (schema + `COPY` bulk load; SQLite fallback included) |
| Analysis / ML | Python (pandas, scikit-learn — logistic regression, 0.863 AUC) |
| Backend | Node.js, Express, `pg` (node-postgres), OpenAI SDK |
| GenAI | OpenAI API (gpt-4o-mini) — text-to-SQL, explanations, email drafting |
| Frontend | React (Vite), Recharts |
| Deployment | Docker · Google Cloud Run · Neon (Postgres) · Vercel — see `DEPLOYMENT.md` |
| BI dashboards | Power BI (live Postgres connection, DAX) — see `/bi-dashboards` |
| Legacy dashboards | Streamlit + static HTML versions — see `/legacy` |

## Key metrics

- Base churn rate: 26.9%
- Model: 0.863 AUC, 82.4% accuracy, 75.7% precision, 50.9% recall
- Top-2-decile capture: 55% of all churn in 20% of users
- New-account risk: 44% churn in first 90 days vs. 18% after 2+ years
- Demographic churn variance: <2 percentage points across country and age

## Limitations

- Modeled/synthetic dataset — useful for demonstrating method, not for
  citing as real-world churn statistics.
- 50.9% recall means the model misses about half of churners at its
  default threshold — this is why the recommendation is a ranked decile
  approach, not a binary cutoff.
- The NL2SQL agent is only as good as the schema description it's given;
  ambiguous questions ("who are our best users?") may need follow-up
  clarification the current single-turn implementation doesn't ask for.
- The AI routes are rate-limited (`rateLimit.js`) and meant to run behind a
  hard OpenAI spending cap, but there's no user authentication — fine for a
  public read-only portfolio demo; a real deployment handling private data
  would add auth and move secrets to a manager like Google Secret Manager.
- Cost: the AI features call OpenAI (pay-per-use). gpt-4o-mini is very cheap,
  but always set a hard spending limit — see `DEPLOYMENT.md` §0.

## Author

Kanishka Singh — [LinkedIn](https://www.linkedin.com/in/kanishka-singh-409292212) · [GitHub](https://github.com/KanishkaSingh19)
