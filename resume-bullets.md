# Resume bullets — Signal: Product Analytics & Retention Intelligence
(full-stack AI product: PostgreSQL + Python/ML + React + OpenAI + Cloud)

## Option A (leads with the product + finding — recommended)

**AI Retention Intelligence Platform | PostgreSQL, Python, React, OpenAI, GCP**
*[Month Year] – [Month Year]*

- Built a full-stack churn product on a PostgreSQL database (25K users, 100K+
  sessions), with a self-built synthetic data generator producing realistic,
  noise-driven, internally consistent data.
- Trained a logistic regression churn model (scikit-learn, 0.863 ROC-AUC) and
  turned it into a risk-ranking where the top 20% of users capture 55% of all
  churn — an actionable targeting strategy, not just a KPI.
- Built an AI "Retention Copilot" with the OpenAI API: a text-to-SQL agent
  that answers plain-English questions with real, guarded SQL; per-user churn
  explanations; and auto-drafted personalized win-back emails — turning a
  churn score into an explanation and a ready-to-send action.
- Containerized the API with Docker and deployed on Google Cloud Run, backed
  by managed PostgreSQL (Neon) and a Vercel React frontend; secured the LLM
  layer with SQL guardrails, read-only DB transactions, per-IP rate limiting,
  and hard spending caps. Live: [your hosted link]

## Option B (shorter, 3 bullets)

**AI Retention Intelligence Platform | PostgreSQL, Python, React, OpenAI, GCP**
*[Month Year] – [Month Year]*

- Built a full-stack AI churn product (PostgreSQL + Python/scikit-learn +
  Node/Express + React), including a custom synthetic data generator and a
  churn model (0.863 AUC) whose top 20% of ranked users capture 55% of churn.
- Shipped an OpenAI-powered "Retention Copilot": text-to-SQL Q&A grounded in
  real queries, AI explanations of each at-risk user, and auto-drafted
  win-back emails — with SQL guardrails, read-only transactions, and rate
  limiting protecting the AI layer.
- Containerized with Docker and deployed on Google Cloud Run + Neon +
  Vercel. Live: [your hosted link]

## Skills this project legitimately demonstrates

- **SQL** — real PostgreSQL, window functions (NTILE, RANK, LAG), CTEs,
  cohort analysis, `COPY` bulk loading.
- **Python / ML** — pandas, scikit-learn, logistic regression, model
  evaluation (AUC/precision/recall), feature engineering, synthetic data.
- **GenAI / LLM engineering** — OpenAI API, tool calling / text-to-SQL,
  prompt design, grounding against hallucination, LLM output guardrails.
- **React / frontend** — React + Vite, component architecture, hooks,
  Recharts, API integration.
- **Backend** — Node.js, Express, REST design, connection pooling,
  server-side secret management.
- **Cloud / DevOps** — Docker, Google Cloud Run, managed Postgres (Neon),
  Vercel, cost controls (spending caps, rate limiting).
- **BI** — Power BI (DAX, live Postgres connection) — see bi-dashboards guide.

## Notes

- Only list a skill once you can talk through it — read `interview-prep.md`
  sections 6-7 (AI features, cloud) before listing OpenAI/GCP.
- Fill in `[Month Year]` and `[your hosted link]`. Check dates aren't in the
  future relative to today.
- Build the Power BI dashboard (see bi-dashboards/) before keeping "Power BI"
  on the resume — the guide is there, the .pbix is yours to make.
