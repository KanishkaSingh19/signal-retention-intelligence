# BI Tools — Resume Notes (Power BI + Tableau)

## The honesty point first

Your current resume lists "Power BI, DAX" but the project didn't have a
`.pbix` file — only the web dashboards. Once you follow `POWERBI_GUIDE.md`
and actually build the Power BI report, the claim becomes true. **Don't
list Power BI or Tableau on the resume until the corresponding dashboard
actually exists and you can open it in an interview.**

## Recommended split

- **Retention/Signal project → Power BI** (connected to Postgres). Strong
  because it's live-DB-connected with real DAX measures.
- **Swiggy Instamart project → Tableau** (published on Tableau Public).
  Strong because it gives you a live, clickable link and fits the
  qualitative/exploratory data.

This shows both tools without building the same thing twice.

## Retention project — revised BI bullet

Add to the existing Signal/retention project bullets:

- "Built a 3-page Power BI report connected live to the PostgreSQL
  database, with DAX measures for churn rate, retention, churn-vs-benchmark,
  and a risk-decile lift view — the same analysis in the tool an internal
  BI team would use."

## Swiggy project — revised BI bullet

- "Built an interactive Tableau dashboard synthesizing 10 interviews, 52
  survey responses, and 100+ app reviews into retention-funnel, pain-point,
  sentiment, and competitor-benchmark views; published live on Tableau
  Public [link]."

## Skills section

Only after both are built, you can legitimately list:
`Power BI (DAX, PostgreSQL connector), Tableau (Tableau Public, table
calculations)` — and be ready to back each with the dashboard it came from.

## What an interviewer may probe (both tools)

- **Filter context** (Power BI): why `Churn vs Benchmark` uses `ALL()`.
- **Table calculations** (Tableau): how the funnel drop-off `LOOKUP` works.
- **Measure vs calculated column** (Power BI) / **dimension vs measure**
  (Tableau) — know the distinction cold.
- "Why two different tools?" — the workload-fit answer in each guide.
