# Power BI Build Guide — Signal Retention Intelligence

This builds a Power BI dashboard connected **live to your Postgres
database**, mirroring (and extending) the web dashboard. Everything here
uses the real `retention` database from the main project. Expected numbers
are given so you can confirm each visual is correct.

Target outcome: a 3-page `.pbix` report — Executive Overview, Churn Drivers,
Content & Growth — driven by DAX measures, that you can screenshot for the
repo and talk through in an interview.

---

## 1. Connect Power BI to Postgres

1. Make sure your Postgres `retention` database is loaded (`python3
   load_pg.py` from the `sql/` folder).
2. In Power BI Desktop: **Home → Get Data → PostgreSQL database.**
   - Server: `localhost` (or your host)
   - Database: `retention`
   - **Data Connectivity mode:** choose **Import** (simpler, snappier for a
     dataset this size — 25K rows is tiny; DirectQuery is for huge/live
     data and limits some DAX, so Import is the right call here).
   - If prompted for the Npgsql driver, install it (Power BI will link you).
3. Credentials: Database → user `postgres` / your password.
4. In the Navigator, check all four tables — `users`, `content`,
   `watch_history`, `ratings` — and click **Load**.

> If you don't want a live DB dependency for the screenshots, you can
> instead Get Data → Text/CSV and load the four CSVs. The DAX below is
> identical either way. But "connected to Postgres" is the stronger
> interview line, so prefer the DB connection.

---

## 2. Set up the data model (relationships)

Go to **Model view**. Power BI may auto-detect some relationships; verify
these exist (create any that are missing by dragging field to field). All
are one-to-many, single-direction, from the "one" side:

- `users[user_id]` 1 → * `watch_history[user_id]`
- `users[user_id]` 1 → * `ratings[user_id]`
- `content[content_id]` 1 → * `watch_history[content_id]`
- `content[content_id]` 1 → * `ratings[content_id]`

Set `users` as effectively the central dimension. Keep cross-filter
direction **Single** (don't use Both — it's unnecessary here and can cause
ambiguous filter paths).

---

## 3. Create a measures table (good practice)

**Home → Enter Data →** name it `_Measures`, add one dummy column, load,
then delete the column later. All measures below live here so they're not
scattered across tables. (This is a small professionalism signal reviewers
notice.)

---

## 4. Core DAX measures

Create these via **New Measure**. Paste one at a time.

### Base counts and churn

```dax
Total Users = COUNTROWS ( users )
```

```dax
Churned Users = CALCULATE ( COUNTROWS ( users ), users[churn] = 1 )
```

```dax
Churn Rate =
DIVIDE ( [Churned Users], [Total Users] )
```
Format this measure as **Percentage** (Measure tools → % ). Expected
overall value: **~26.9%**.

```dax
Retention Rate = 1 - [Churn Rate]
```
Format as Percentage. Expected: ~73.1%.

### Engagement

```dax
Avg Watch Hours = AVERAGE ( users[watch_time_hours] )
```

```dax
Avg Tenure Days = AVERAGE ( users[tenure_days] )
```
Expected ~563.

```dax
Total Sessions = COUNTROWS ( watch_history )
```
Expected 100,455.

```dax
Avg Completion Rate =
AVERAGE ( watch_history[completion_rate] )
```

```dax
Avg Rating = AVERAGE ( ratings[rating] )
```

### Churn benchmark (for the over/under-performance visual)

```dax
Overall Churn Benchmark =
CALCULATE ( [Churn Rate], ALL ( users ) )
```

```dax
Churn vs Benchmark =
[Churn Rate] - [Overall Churn Benchmark]
```
This lets you show, per segment, how far above/below the platform average
it sits. Format as Percentage.

---

## 5. Calculated columns for banding

These are **columns** (New Column), not measures — they bucket continuous
fields so you can put them on an axis.

```dax
Tenure Band =
SWITCH (
    TRUE (),
    users[tenure_days] <= 90, "0-90 days",
    users[tenure_days] <= 180, "91-180 days",
    users[tenure_days] <= 365, "181-365 days",
    users[tenure_days] <= 730, "1-2 years",
    "2+ years"
)
```

```dax
Support Ticket Band =
SWITCH (
    TRUE (),
    users[support_tickets] = 0, "0 tickets",
    users[support_tickets] = 1, "1 ticket",
    users[support_tickets] = 2, "2 tickets",
    "3+ tickets"
)
```

```dax
Recency Band =
SWITCH (
    TRUE (),
    users[days_since_login] <= 2, "0-2 days",
    users[days_since_login] <= 5, "3-5 days",
    users[days_since_login] <= 10, "6-10 days",
    users[days_since_login] <= 20, "11-20 days",
    users[days_since_login] <= 40, "21-40 days",
    "40+ days"
)
```

```dax
Age Band =
SWITCH (
    TRUE (),
    users[age] <= 24, "18-24",
    users[age] <= 34, "25-34",
    users[age] <= 44, "35-44",
    users[age] <= 54, "45-54",
    "55+"
)
```

To make bands sort correctly on axes (not alphabetically), add a matching
sort-order column, e.g.:

```dax
Tenure Band Order =
SWITCH (
    TRUE (),
    users[tenure_days] <= 90, 1,
    users[tenure_days] <= 180, 2,
    users[tenure_days] <= 365, 3,
    users[tenure_days] <= 730, 4,
    5
)
```
Then select `Tenure Band` → **Column tools → Sort by column → Tenure Band
Order**. Repeat the pattern for the other bands if their order looks wrong.

---

## 6. The risk-decile measure (your headline visual)

The web app computes risk deciles in Python. In Power BI you can reproduce
a **behavioral-proxy** version directly with DAX, so the marquee finding
("top decile churns far more than the bottom") lives in the BI tool too.

First a per-user risk proxy column (higher = riskier: more days idle, fewer
watch hours):

```dax
Risk Proxy =
VAR MaxIdle = MAXX ( ALL ( users ), users[days_since_login] )
VAR MaxWatch = MAXX ( ALL ( users ), users[watch_time_hours] )
RETURN
    DIVIDE ( users[days_since_login], MaxIdle )
        - DIVIDE ( users[watch_time_hours], MaxWatch )
```

Then a decile column (1 = lowest risk, 10 = highest):

```dax
Risk Decile =
VAR r =
    RANK.EQ ( users[Risk Proxy], users[Risk Proxy], ASC )
VAR n = COUNTROWS ( ALL ( users ) )
RETURN
    ROUNDUP ( DIVIDE ( r, n ) * 10, 0 )
```

Now a clustered column chart of `Risk Decile` (axis) vs `Churn Rate`
(value) shows the monotonic lift. Note: this DAX proxy won't exactly match
the Python model's deciles (that's a real logistic regression), so in your
notes/interview say: *"the exact risk score comes from the Python model;
this Power BI version reproduces the same lift pattern with a behavioral
proxy so the finding is visible directly in the BI layer."* Honest and
still impressive.

---

## 7. Page-by-page layout

### Page 1 — Executive Overview
- **KPI cards** (top row): `Total Users` (25,000), `Churn Rate` (~26.9%),
  `Retention Rate`, `Avg Tenure Days`, `Total Sessions`.
- **Column chart:** `Risk Decile` × `Churn Rate` — the lift chart. Add
  data labels. This is the visual you lead with.
- **Donut:** `subscription_type` × `Total Users`.
- **Line chart:** sessions over time — put `watch_history[watch_date]` on
  the axis (Power BI auto-creates a date hierarchy; drill to month) and
  `Total Sessions` as the value.
- **Slicer:** `subscription_type` (so the whole page is filterable — the
  interactive element reviewers like).

### Page 2 — Churn Drivers
- **Column chart:** `Tenure Band` × `Churn Rate`. Expected: 44% (0-90d)
  descending to 18% (2yr+).
- **Column chart:** `Support Ticket Band` × `Churn Rate`. Expected: 21% →
  32% → 43% → 57%.
- **Column chart:** `Recency Band` × `Churn Rate`.
- **Bar chart:** `country` × `Churn vs Benchmark` — shows who's above/below
  the ~26.9% line (all within ~1 point; the point is "geography barely
  matters," which is itself a finding).
- Add a short **text box** stating the takeaway: "Behavior (tenure,
  tickets, recency) drives churn; demographics don't."

### Page 3 — Content & Growth
- **Bar chart:** genre × `Total Sessions` (views). Thriller/Sci-Fi top.
- **Bar chart:** genre × `Avg Completion Rate`.
- **Table:** top titles by views — `content[title]`, `genre`,
  `Total Sessions`; sort desc, Top-N filter = 10.
- **Card:** `Avg Rating`, `Avg Completion Rate`.

---

## 8. Polish (do these — they're what separate a 6/10 from an 8/10 dashboard)

- **Consistent theme:** View → Themes → pick one dark theme (to echo the
  web app) or a clean light one. Don't leave default colors.
- **Titles on every visual**, written as insights not labels: "Churn falls
  sharply with tenure" beats "Churn Rate by Tenure Band."
- **Format churn measures as %** with 1 decimal, not raw decimals.
- **Align visuals to a grid** (View → gridlines/snap to grid).
- One consistent accent color for the "risk/bad" bars (a red/rose) and a
  neutral for everything else, so the eye goes to the churn story.

---

## 9. Getting it into your repo

`.pbix` files are binary and can be large, but yours will be small (Import
mode, 25K rows). Two options:

1. **Commit the .pbix** to the repo under `/powerbi/`. Fine if it's under
   ~25 MB (yours should be). `git add powerbi/retention.pbix`.
2. **Export to PDF** (File → Export → PDF) and commit that too, plus 2-3
   **PNG screenshots** of the pages — because most people (recruiters
   especially) won't open a `.pbix`, but they'll look at an image. Put
   screenshots in `/powerbi/screenshots/` and embed them in the README.

Either way, add a line to the main README's dashboard section:
"`/powerbi/` — Power BI report connected live to the Postgres database
(DAX measures for churn rate, retention, risk deciles, cohort retention)."

---

## 10. What to say about it in an interview

- "The React dashboard is the public-facing version; the Power BI report is
  the same analysis in the tool an internal BI team would actually use,
  connected live to Postgres."
- Be ready to explain **one DAX measure** end to end — `Churn Rate` with
  `DIVIDE` and `CALCULATE` is the safest to talk through, or `Churn vs
  Benchmark` using `ALL()` to remove filter context (that one shows you
  understand filter context, which is the concept Power BI interviews
  probe most).
- Know the difference between a **measure** (calculated at query time,
  respects filters) and a **calculated column** (computed once at load,
  row-level) — you used both here, and knowing why is a common question.
