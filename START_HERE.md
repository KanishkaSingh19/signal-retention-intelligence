# START HERE — First-Time Setup (Windows)

This guide gets the project running on your computer, step by step, assuming
you've never done this before. Do the parts in order. If anything errors,
copy the exact error message and ask for help — don't push past it.

You already have installed: Node.js, Python, and PostgreSQL (server on port
5432). Good. If `psql` isn't recognized in PowerShell that's OK — the loader
below doesn't need it.

---

## Part 1 — Create the database (in pgAdmin)

1. Open **pgAdmin 4**.
2. In the left sidebar, connect to your working PostgreSQL server (the one
   on port 5432 whose password you know).
3. Right-click that server → **Create** → **Database…**
4. Name it exactly: `retention`
5. Click **Save**.

You now have an empty `retention` database.

---

## Part 2 — Load the data (in PowerShell)

Open PowerShell and go into this project's `sql` folder. Replace the path
with wherever you unzipped this folder, e.g.:

```
cd C:\Users\YOURNAME\Desktop\signal-fullstack\sql
```

Install the Python libraries the loader needs:
```
pip install -r requirements.txt
```

Set the database connection — replace `YOURPASSWORD` with your real
PostgreSQL password:
```
$env:DATABASE_URL="postgresql://postgres:YOURPASSWORD@localhost:5432/retention"
```

Load the data:
```
python load_pg.py
```

SUCCESS looks like it printing:
```
users: 25,000 rows
content: 500 rows
watch_history: 100,455 rows
ratings: 40,131 rows
```

If you see those numbers, the database is loaded. ✓

---

## Part 3 — Get an OpenAI API key

1. Go to **https://platform.openai.com** (note: `platform.`)
2. Sign up / log in (Google login is fine).
3. Settings (gear icon) → **Billing** → add a payment method and **$5 of
   credit** (the API is prepaid; the key won't work without a little credit).
4. Settings → **Limits** → set a **hard limit of $5**. Do this now — it means
   you can never be charged more than $5, ever.
5. Left menu → **API keys** → **Create new secret key** → name it
   `signal-project` → create.
6. **Copy the key immediately** (starts with `sk-proj-...`) and paste it
   somewhere safe. You only see it once.

Never share this key or put it on GitHub. (This project's `.gitignore`
already protects the `.env` file where it goes.)

---

## Part 4 — Start the backend (a NEW PowerShell window)

```
cd C:\Users\YOURNAME\Desktop\signal-fullstack\backend
npm install
```

Create your config file:
```
copy .env.example .env
```

Open the new `.env` file in Notepad (or any editor) and fill in two lines
with your real values:
```
OPENAI_API_KEY=sk-proj-...your key...
DATABASE_URL=postgresql://postgres:YOURPASSWORD@localhost:5432/retention
```
Save and close it. (Make sure the file is named exactly `.env`, not
`.env.txt` — Windows sometimes hides the real extension.)

Start the backend:
```
npm start
```

You want to see `OPENAI_API_KEY set: true`. Leave this window running.

Test it: open a browser to **http://localhost:3001/api/health**
You should see `"ai_enabled":true`.

---

## Part 5 — Start the frontend (a THIRD PowerShell window)

```
cd C:\Users\YOURNAME\Desktop\signal-fullstack\frontend
npm install
copy .env.example .env
npm run dev
```

It prints a local address, usually **http://localhost:5173** — open that in
your browser.

---

## Part 6 — Confirm it all works

In the browser:
1. **Dashboard** tab → charts appear (app loads).
2. **Copilot** tab → a list of high-risk users appears (backend + DB work).
3. **Click a user** → after a second, an AI explanation appears (OpenAI works).
4. Click **Professional** → a win-back email is generated.
5. **Ask Signal** tab → type "what is the churn rate?" → it answers.

If all of that works, your project is live end-to-end. 🎉

---

## Common first-time issues

- **`ai_enabled: false`** → `.env` not saved right, or named `.env.txt`.
- **Copilot error / `ECONNREFUSED 5432`** → wrong DB password in `.env`, or
  Postgres server not running.
- **`pip` or `python` not recognized** → reopen PowerShell; if still broken,
  Python's PATH option wasn't checked at install.
- **Frontend can't reach backend** → make sure the backend window (Part 4)
  is still running.

When stuck, copy the exact red error text and ask — that's normal for a
first run.

---

## What's in this folder

- `sql/` — data files, the Postgres loader (`load_pg.py`), schema, and the
  SQL query library.
- `data/` — the analysis script and precomputed `data.json`.
- `backend/` — the Node/Express API with the three AI features.
- `frontend/` — the React app (Dashboard, Copilot, Ask Signal, Case Study).
- `bi-dashboards/` — Power BI and Tableau build guides.
- `DEPLOYMENT.md` — how to put it online (Neon + Cloud Run + Vercel) later.
- `README.md` — full project overview.
- `interview-prep.md` — study this before interviews.
- `resume-bullets.md` — ready-to-use resume lines.
- `legacy/` — earlier Streamlit/HTML versions (ignore for now).
