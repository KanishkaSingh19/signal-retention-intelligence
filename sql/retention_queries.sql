--------------------------------------------------
-- RETENTION INTELLIGENCE — SQL QUERY LIBRARY
-- Written for PostgreSQL (schema in schema.sql).
-- Tables: users, content, watch_history, ratings
--------------------------------------------------

--------------------------------------------------
-- BASIC QUERIES
--------------------------------------------------

-- 1. How many users are on the platform?
SELECT COUNT(*) AS total_users
FROM users;

-- 2. Which subscription plan is most popular?
SELECT
    subscription_type,
    COUNT(*) AS users
FROM users
GROUP BY subscription_type
ORDER BY users DESC;

-- 3. How engaged are users overall?
SELECT
    ROUND(AVG(watch_time_hours), 2) AS avg_watch_time_hours,
    ROUND(AVG(tenure_days), 0)      AS avg_tenure_days,
    ROUND(AVG(support_tickets), 2)  AS avg_support_tickets
FROM users;

-- 4. Which genres have the largest content library?
SELECT
    genre,
    COUNT(*) AS titles
FROM content
GROUP BY genre
ORDER BY titles DESC;

-- 5. What is the average user rating on the platform?
SELECT
    ROUND(AVG(rating), 2) AS avg_rating,
    COUNT(*) AS total_ratings
FROM ratings;


--------------------------------------------------
-- INTERMEDIATE QUERIES
--------------------------------------------------

-- 1. Which content genres generate the highest engagement and deserve
--    greater investment in content production and promotion?
SELECT
    c.genre,
    COUNT(*) AS total_views,
    ROUND(AVG(w.completion_rate), 1) AS avg_completion_rate
FROM watch_history w
JOIN content c ON w.content_id = c.content_id
GROUP BY c.genre
ORDER BY total_views DESC;

-- 2. Which titles drive the highest platform engagement?
SELECT
    c.title,
    c.genre,
    COUNT(*) AS views
FROM watch_history w
JOIN content c ON w.content_id = c.content_id
GROUP BY c.title, c.genre
ORDER BY views DESC
LIMIT 10;

-- 3. Which subscription plans have the highest churn, and where should
--    retention efforts be focused? (spoiler: barely any difference --
--    plan is not a useful targeting variable on its own)
SELECT
    subscription_type,
    COUNT(*) AS users,
    ROUND(AVG(churn) * 100, 2) AS churn_rate_pct
FROM users
GROUP BY subscription_type
ORDER BY churn_rate_pct DESC;

-- 4. Which genres keep viewers engaged until the end of the content?
SELECT
    c.genre,
    ROUND(AVG(w.completion_rate), 2) AS avg_completion
FROM watch_history w
JOIN content c ON w.content_id = c.content_id
GROUP BY c.genre
ORDER BY avg_completion DESC;

-- 5. Which genres receive the strongest audience satisfaction?
SELECT
    c.genre,
    ROUND(AVG(r.rating), 2) AS avg_rating,
    COUNT(*) AS num_ratings
FROM ratings r
JOIN content c ON r.content_id = c.content_id
GROUP BY c.genre
HAVING COUNT(*) >= 100
ORDER BY avg_rating DESC;

-- 6. Churn rate by days since last login -- the real behavioral signal
SELECT
    CASE
        WHEN days_since_login <= 2  THEN '0-2 days'
        WHEN days_since_login <= 5  THEN '3-5 days'
        WHEN days_since_login <= 10 THEN '6-10 days'
        WHEN days_since_login <= 20 THEN '11-20 days'
        WHEN days_since_login <= 40 THEN '21-40 days'
        ELSE '40+ days'
    END AS recency_band,
    COUNT(*) AS users,
    ROUND(AVG(churn) * 100, 2) AS churn_rate_pct
FROM users
GROUP BY recency_band
ORDER BY MIN(days_since_login);

-- 7. Churn rate by account tenure -- reveals the onboarding risk window
SELECT
    CASE
        WHEN tenure_days <= 90   THEN '0-90 days'
        WHEN tenure_days <= 180  THEN '91-180 days'
        WHEN tenure_days <= 365  THEN '181-365 days'
        WHEN tenure_days <= 730  THEN '1-2 years'
        ELSE '2+ years'
    END AS tenure_band,
    COUNT(*) AS users,
    ROUND(AVG(churn) * 100, 2) AS churn_rate_pct
FROM users
GROUP BY tenure_band
ORDER BY MIN(tenure_days);

-- 8. Churn rate by support ticket volume
SELECT
    CASE
        WHEN support_tickets = 0 THEN '0 tickets'
        WHEN support_tickets = 1 THEN '1 ticket'
        WHEN support_tickets = 2 THEN '2 tickets'
        ELSE '3+ tickets'
    END AS ticket_band,
    COUNT(*) AS users,
    ROUND(AVG(churn) * 100, 2) AS churn_rate_pct
FROM users
GROUP BY ticket_band
ORDER BY MIN(support_tickets);


--------------------------------------------------
-- ADVANCED QUERIES (window functions, CTEs)
--------------------------------------------------

-- 1. How do genres compare in overall platform demand?
SELECT
    genre,
    total_views,
    RANK() OVER (ORDER BY total_views DESC) AS genre_rank
FROM (
    SELECT
        c.genre,
        COUNT(*) AS total_views
    FROM watch_history w
    JOIN content c ON w.content_id = c.content_id
    GROUP BY c.genre
) t;

-- 2. Who is the most engaged user in each market?
SELECT *
FROM (
    SELECT
        user_id,
        country,
        watch_time_hours,
        ROW_NUMBER() OVER (
            PARTITION BY country
            ORDER BY watch_time_hours DESC
        ) AS rn
    FROM users
) t
WHERE rn = 1;

-- 3. How is platform engagement changing month over month?
SELECT
    to_char(watch_date, 'YYYY-MM') AS month,
    COUNT(*) AS sessions,
    LAG(COUNT(*)) OVER (ORDER BY to_char(watch_date, 'YYYY-MM')) AS prev_month_sessions
FROM watch_history
GROUP BY month
ORDER BY month;

-- 4. Which subscription plans over/under-perform the platform churn benchmark?
WITH overall AS (
    SELECT AVG(churn) AS avg_churn FROM users
)
SELECT
    u.subscription_type,
    ROUND(AVG(u.churn) * 100, 2) AS churn_rate_pct,
    ROUND((AVG(u.churn) - overall.avg_churn) * 100, 2) AS diff_vs_benchmark_pts
FROM users u
CROSS JOIN overall
GROUP BY u.subscription_type, overall.avg_churn;

-- 5. Top 3 titles driving engagement within each genre
SELECT *
FROM (
    SELECT
        c.genre,
        c.title,
        COUNT(*) AS views,
        ROW_NUMBER() OVER (
            PARTITION BY c.genre
            ORDER BY COUNT(*) DESC
        ) AS rn
    FROM watch_history w
    JOIN content c ON w.content_id = c.content_id
    GROUP BY c.genre, c.title
) t
WHERE rn <= 3;

-- 6. Risk segmentation using NTILE -- the decile lift/gains view.
--    A rough behavioral proxy (recency + inverse watch time), NOT the
--    full logistic model -- that lives in Python (see data/analyze.py).
--    Included here to show the same lift pattern is visible directly
--    in SQL using window functions, without needing Python at all.
WITH scored AS (
    SELECT
        user_id,
        churn,
        days_since_login,
        watch_time_hours,
        -- simple composite risk proxy: higher = riskier
        (days_since_login * 1.0 / NULLIF(MAX(days_since_login) OVER (), 0))
        - (watch_time_hours * 1.0 / NULLIF(MAX(watch_time_hours) OVER (), 0))
        AS risk_proxy
    FROM users
),
deciled AS (
    SELECT
        *,
        NTILE(10) OVER (ORDER BY risk_proxy ASC) AS risk_decile
    FROM scored
)
SELECT
    risk_decile,
    COUNT(*) AS users,
    ROUND(AVG(churn) * 100, 1) AS churn_rate_pct
FROM deciled
GROUP BY risk_decile
ORDER BY risk_decile;

-- 7. Cohort retention: of users who signed up in a given month, what
--    share are still active (not churned) as of the dataset snapshot?
SELECT
    to_char(signup_date, 'YYYY-MM') AS signup_cohort,
    COUNT(*) AS cohort_size,
    ROUND(AVG(1 - churn) * 100, 1) AS retained_pct
FROM users
GROUP BY signup_cohort
ORDER BY signup_cohort;
