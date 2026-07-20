# Tableau Build Guide — Swiggy Instamart Product Teardown

This puts a Tableau dashboard on your **Swiggy Instamart** project (keeping
Power BI on the retention project, so each project shows a different BI tool
instead of duplicating). Tableau suits this one because it's
survey/interview/review data — exploratory and visual, which is Tableau's
strength.

Because your Swiggy project is qualitative-heavy (10 interviews, 52 survey
responses, 100+ reviews, competitor benchmarking), you'll first shape that
into a few tidy tables Tableau can read, then build the visuals.

---

## 1. Prepare the data (the real work is here)

Tableau needs tabular data. Create these as simple CSVs/Google Sheets from
your existing research. You likely already have most of this in your project
notes — this just structures it.

### `survey_responses.csv`
One row per survey respondent. Suggested columns:
```
respondent_id, age_group, city_tier, order_frequency, primary_use_case,
top_pain_point, nps_score, would_recommend
```
52 rows. `nps_score` 0-10; `top_pain_point` a small set of categories
(e.g., "delivery time", "product availability", "app UX", "pricing").

### `app_reviews.csv`
One row per review you analyzed:
```
review_id, source, star_rating, sentiment, theme
```
`sentiment` = Positive / Neutral / Negative; `theme` = the issue category.
~100 rows.

### `competitor_benchmark.csv`
One row per platform per criterion (long format works best in Tableau):
```
platform, criterion, score
```
e.g. platform ∈ {Instamart, Blinkit, Zepto, BigBasket, ...}, criterion ∈
{delivery speed, catalog breadth, pricing, app UX, availability}, score 1-5.

### `retention_funnel.csv`
Your funnel stages with drop-off:
```
stage, users_remaining
```
e.g. Install → First order → Second order → Repeat (30d) → Retained (90d).

> Structuring qualitative research into clean tables **is** an analyst
> skill — call this out in the project write-up. "Synthesized 100+ reviews
> into a coded, themed dataset" is a real bullet.

---

## 2. Connect and set up

1. Tableau Public (free) or Tableau Desktop → **Connect → Text file** →
   load each CSV. (Tableau Public is fine and gives you a shareable public
   link, which is great for a resume — but note it makes the workbook
   public, which is fine for a portfolio project.)
2. Each CSV becomes its own data source. You don't strictly need to join
   them — build a sheet per source, then combine on a dashboard.

---

## 3. Sheets to build

### Sheet 1 — Retention funnel
- From `retention_funnel`. Put `stage` on Rows (sorted by your stage
  order), `users_remaining` on Columns → **Bar chart**.
- Add a calculated field for drop-off %:
  ```
  // Drop-off from previous stage
  (LOOKUP(SUM([Users Remaining]), -1) - SUM([Users Remaining]))
  / LOOKUP(SUM([Users Remaining]), -1)
  ```
  Format as %, add to Label. This makes the second-order drop-off (your key
  bottleneck) pop.

### Sheet 2 — Pain points (survey)
- From `survey_responses`. `top_pain_point` on Rows, `COUNT` on Columns,
  sorted descending → horizontal bar. Color by pain point.
- This visualizes what your RICE prioritization was based on.

### Sheet 3 — Review sentiment by theme
- From `app_reviews`. `theme` on Rows, `COUNT` on Columns, color by
  `sentiment` (Positive green / Neutral grey / Negative red) → **stacked
  bar**. Instantly shows which themes are most negative.

### Sheet 4 — Competitor benchmark (the standout visual)
- From `competitor_benchmark`. Two good options:
  - **Heatmap:** `criterion` on Rows, `platform` on Columns, `score` on
    Color (sequential). Fast to read who wins each criterion.
  - **Radar/spider** isn't native to Tableau; the heatmap is the cleaner,
    more honest choice — use it.

### Sheet 5 — NPS distribution
- From `survey_responses`. Create an NPS category calculated field:
  ```
  IF [nps_score] >= 9 THEN "Promoter"
  ELSEIF [nps_score] >= 7 THEN "Passive"
  ELSE "Detractor" END
  ```
  Then bar or donut of the three categories. Compute the NPS number
  (%Promoters − %Detractors) in a text callout.

---

## 4. Assemble the dashboard

- **New Dashboard.** Size: fixed, ~1200×900 (predictable for screenshots).
- Layout: funnel top-left (the story anchor), pain points top-right,
  sentiment bottom-left, competitor heatmap bottom-right, NPS as a small
  KPI strip up top.
- Add **filter actions**: e.g., clicking a pain point filters the review
  sentiment sheet. Interactivity is a big part of what Tableau is graded on.
- Title it with the finding: "Second-order drop-off is Instamart's core
  retention gap."

---

## 5. Publish and link

- **Tableau Public:** Server → Tableau Public → Save. You get a public URL
  and an embeddable view — put that link in your resume and the project's
  README/case study. This is Tableau's biggest advantage for portfolios:
  a genuinely live, interactive link with zero hosting effort.
- Grab 2-3 **PNG screenshots** for the repo/README too.

---

## 6. Resume bullet (Swiggy project, add this)

- "Built an interactive Tableau dashboard synthesizing 10 interviews, 52
  survey responses, and 100+ app reviews into a retention-funnel, pain-point,
  and competitor-benchmark view — published live on Tableau Public [link]."

---

## 7. Interview notes

- Be ready to explain the **LOOKUP** table calculation in the funnel (it
  references the previous row — a table-calc concept Tableau interviews
  love).
- Know the difference between a **dimension** and a **measure** in Tableau
  (blue vs green pills), and what a **table calculation** is vs a normal
  aggregation.
- Have a one-liner on why Tableau here and Power BI on the other project:
  "Tableau for the exploratory, qualitative research synthesis; Power BI
  connected to Postgres for the operational churn model — I wanted to show
  both tools on the workloads they each fit best."
