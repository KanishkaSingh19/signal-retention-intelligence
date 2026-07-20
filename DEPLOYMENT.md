# Deployment Guide — Signal on Cloud (Neon + Cloud Run + Vercel)

This deploys the full product — database, AI backend, and frontend — on
cloud infrastructure, at effectively $0 for portfolio-level traffic.

Stack:
- **Database:** Neon (managed PostgreSQL, free tier, no card required, scales to zero)
- **Backend:** Google Cloud Run (containerized Node API, always-free tier, scales to zero)
- **Frontend:** Vercel (static React, free, no card)
- **AI:** OpenAI API (pay-per-use, pennies — but set a hard cap, see §0)

Resume line this earns: *"Containerized the API with Docker and deployed on
Google Cloud Run, backed by managed PostgreSQL (Neon) and a Vercel frontend."*

---

## §0 — DO THIS FIRST: cost safety (5 minutes, non-negotiable)

Two independent spend risks: the OpenAI API, and Google Cloud. Cap both.

### OpenAI hard limit
1. platform.openai.com → Settings → **Limits**.
2. Set a **hard monthly budget** (e.g. $5). At the hard cap, OpenAI *stops*
   serving requests — it does not overspend. Set a lower "soft" alert too
   (e.g. $1) to get an email first.
3. This is your real protection for the AI features. gpt-4o-mini is so cheap
   ($0.15 / 1M input tokens) that $5 is thousands of requests — but the cap
   means a runaway loop or someone spamming your public URL can never cost
   more than you set.

### Google Cloud budget alert
1. console.cloud.google.com → Billing → **Budgets & alerts** → Create budget.
2. Amount: **₹100** (or $1). Alert thresholds: 50%, 90%, 100%.
3. You'll get an email the instant anything approaches that. Cloud Run's
   free tier (2M requests/month) means a portfolio app realistically stays
   at $0, but the alert is your safety net.

> The app's own `rateLimit.js` (15 AI requests/IP/min) is a third layer.
> Belt, suspenders, and a backup belt — appropriate when a public URL is
> tied to a paid API key.

---

## §1 — Database on Neon

1. neon.tech → sign up (GitHub login, no card) → **New Project**.
2. Name it `signal`, pick a region near you, Postgres 16.
3. Copy the **connection string** it gives you. It looks like:
   `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`
4. Load your data into it from your machine:
   ```bash
   cd sql
   pip install -r requirements.txt
   export DATABASE_URL="<your-neon-connection-string>"
   python3 load_pg.py
   ```
   Confirm it prints 25,000 / 500 / 100,455 / 40,131 rows.

> Neon requires SSL. `psycopg2` and node-`pg` both honor `sslmode=require`
> from the URL, so no code change needed.

---

## §2 — Backend on Cloud Run

### Prereqs
- Install the gcloud CLI (cloud.google.com/sdk), run `gcloud init`, pick/create a project.
- Enable the needed APIs (one time):
  ```bash
  gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
  ```

### Deploy
From the **repo root** (so the Docker build can see both `backend/` and `data/`):

```bash
gcloud run deploy signal-backend \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_URL=<your-neon-url>,OPENAI_API_KEY=<your-openai-key>,OPENAI_MODEL=gpt-4o-mini"
```

Wait — `--source .` uses Cloud Build with your `backend/Dockerfile`. Because
the Dockerfile lives in `backend/`, either:
- move the Dockerfile to repo root, **or**
- deploy from the repo root but point the build at it. Simplest: create a
  root `Dockerfile` that is just `FROM` your backend one, OR run:
  ```bash
  gcloud builds submit --tag gcr.io/PROJECT_ID/signal-backend --file backend/Dockerfile .
  gcloud run deploy signal-backend \
    --image gcr.io/PROJECT_ID/signal-backend \
    --region asia-south1 --allow-unauthenticated \
    --set-env-vars "DATABASE_URL=...,OPENAI_API_KEY=...,OPENAI_MODEL=gpt-4o-mini"
  ```
  (Replace `PROJECT_ID`. `--file backend/Dockerfile` with `.` context lets it
  copy `data/data.json`.)

Cloud Run gives you an HTTPS URL like
`https://signal-backend-xxxx.a.run.app`. Test it:
```bash
curl https://signal-backend-xxxx.a.run.app/api/health
```
Should return `{"ok":true,"model":"gpt-4o-mini","ai_enabled":true}`.

### Notes
- **Secrets:** for a portfolio app, env vars are acceptable. For extra
  polish, use Google **Secret Manager** and reference secrets with
  `--set-secrets` instead of `--set-env-vars`. Mention this in interviews as
  "I know env vars aren't ideal for secrets; the production move is Secret
  Manager."
- Cloud Run scales to zero: no traffic = no cost. First request after idle
  has a cold-start (~1-2s). Fine for a demo.
- The app listens on `PORT` (Cloud Run injects 8080; the Dockerfile sets it).

---

## §3 — Frontend on Vercel

1. Push the repo to GitHub (see the GitHub steps you already have).
2. vercel.com → **Add New Project** → import the repo.
3. **Root Directory:** set to `frontend` (important — the React app isn't at
   repo root).
4. Framework preset: Vite (auto-detected). Build command `npm run build`,
   output `dist` (auto).
5. **Environment variable:** add
   `VITE_API_BASE = https://signal-backend-xxxx.a.run.app` (your Cloud Run URL).
6. Deploy. You get `https://your-project.vercel.app`.

> Because the frontend calls the backend from the browser, the backend's
> `cors()` must allow it. The current backend uses open CORS (`app.use(cors())`),
> which is fine for a public read-only demo. To lock it down, set
> `cors({ origin: "https://your-project.vercel.app" })`.

---

## §4 — Final wiring checklist

- [ ] Neon has data (row counts correct)
- [ ] Cloud Run `/api/health` returns `ai_enabled: true`
- [ ] Cloud Run env vars: `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`
- [ ] Vercel env var: `VITE_API_BASE` = Cloud Run URL
- [ ] OpenAI hard spending cap set
- [ ] Google Cloud budget alert set
- [ ] Open the Vercel URL → Dashboard loads → Copilot lists users → clicking
      one returns an AI explanation → email generates → Ask Signal answers

---

## §5 — Costs, honestly

- **Neon:** free tier is genuinely free (0.5 GB storage; your DB is a few MB).
- **Cloud Run:** free tier 2M requests/month + scales to zero. A portfolio
  app stays at $0.
- **Vercel:** free hobby tier, no card.
- **OpenAI:** the only real spend. gpt-4o-mini ≈ $0.15 / 1M input + $0.60 /
  1M output. Each Copilot explanation or email is ~500-1500 tokens, so
  fractions of a cent. Your hard cap guarantees the ceiling.

Realistic monthly cost for a portfolio piece with occasional recruiter
traffic: **effectively $0**, capped at whatever OpenAI limit you set.

---

## §6 — If you'd rather not deal with Cloud Run

Every AI feature still works locally. You can:
- Deploy **only the frontend** to Vercel (Dashboard + Case Study work with
  no backend), and demo the Copilot + Ask Signal **live from your laptop**
  (backend + Neon) during interviews.
- Or deploy the backend to **Render** instead of Cloud Run — Render runs the
  Dockerfile or the plain Node app directly, is arguably simpler than Cloud
  Run, and has a free tier (with cold starts). Same env vars.

The cloud-native story (Cloud Run + Docker) is the more impressive resume
line; Render is the lower-friction path to the same working result.

---

## §7 — Interview talking points

- "Three-tier: managed Postgres on Neon, a containerized Node API on Cloud
  Run, and a Vercel-hosted React frontend."
- "The API key never touches the frontend — it's a server-side env var on
  Cloud Run, and the AI routes are rate-limited and capped."
- "Cloud Run scales to zero, so the app costs nothing when idle — I chose it
  partly to keep a student project genuinely free."
- Know why you containerized: "Docker makes the backend portable — the same
  image runs on Cloud Run, Render, or my laptop, with config injected via
  env vars."
