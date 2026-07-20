"""
generate_data.py
-----------------
Generates a realistic, internally-consistent synthetic dataset for a
subscription streaming platform: users, watch_history, ratings, content.

Design goals (what makes this different from a naive random generator):
  1. Churn is a NOISY logistic function of multiple weighted signals, not a
     hard threshold. Real churn is never a clean cliff.
  2. Tables are cross-consistent: a user's "favorite genre" is DERIVED from
     what they actually watched, not an independent random label. Watch
     sessions never occur after a user's last-login date. Completion rate
     drives session duration, not the other way around at random.
  3. Individual heterogeneity (a latent "engagement propensity") drives
     watch time, recency, and churn together, the way real user behavior
     is internally correlated rather than drawn independently per column.
  4. Effects are proportionate: recency + engagement dominate churn risk,
     support tickets and tenure contribute moderately, demographics
     contribute weakly -- mirroring what real churn models typically find.
"""

import os
import numpy as np
import pandas as pd
from datetime import timedelta

RNG = np.random.default_rng(42)
REF_DATE = pd.Timestamp("2026-06-30")   # "today" for the dataset
N_USERS = 25000
N_CONTENT = 500

COUNTRIES = ["USA", "UK", "Canada", "Germany", "France", "India", "Brazil", "Japan", "Australia", "Mexico"]
GENRES = ["Drama", "Sci-Fi", "Comedy", "Documentary", "Romance", "Action", "Horror", "Thriller", "Crime", "Fantasy", "Adventure"]
SUB_TYPES = ["Basic", "Standard", "Premium"]
SUB_PRICE = {"Basic": 8.99, "Standard": 13.99, "Premium": 17.99}

FIRST_NAMES = ["James","Mary","John","Patricia","Robert","Jennifer","Michael","Linda","William","Elizabeth",
               "David","Barbara","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Charles","Karen",
               "Ananya","Wei","Hiroshi","Fatima","Carlos","Sofia","Lucas","Emma","Noah","Olivia"]
LAST_NAMES = ["Martinez","Miller","Smith","Johnson","Brown","Garcia","Davis","Wilson","Anderson","Taylor",
              "Thomas","Moore","Jackson","White","Harris","Clark","Lewis","Walker","Hall","Young"]

# -----------------------------------------------------------------
# 1. CONTENT
# -----------------------------------------------------------------
def gen_content():
    adjectives = ["Hidden","Lost","Broken","Eternal","Secret","Forgotten","Silent","Dark","Golden","Final",
                  "Crimson","Frozen","Burning","Rising","Shattered","Distant","Quiet","Wild","Sacred","Last",
                  "Restless","Fading","Radiant","Bitter","Endless","Reckless","Solitary","Vanishing","Stolen","Unspoken"]
    nouns = ["Legacy","Destiny","Promise","Kingdom","Horizon","Rebellion","Empire","Storm","Dream","Escape",
             "Awakening","Shadow","Night","Journey","Truth","Reckoning","Hunter","Whisper","Echo","Flame",
             "Signal","Harbor","Descent","Ashes","Mirage","Verdict","Passage","Tide","Requiem","Bloom"]

    titles = set()
    attempts = 0
    while len(titles) < N_CONTENT and attempts < N_CONTENT * 50:
        titles.add(f"{RNG.choice(adjectives)} {RNG.choice(nouns)}")
        attempts += 1
    titles = list(titles)

    rows = []
    for i, title in enumerate(titles):
        genre = RNG.choice(GENRES)
        release_year = int(RNG.integers(2015, 2026))
        duration = int(np.clip(RNG.normal(110, 30), 45, 210))
        quality = float(np.clip(RNG.normal(0, 1), -2.5, 2.5))  # internal only
        rows.append({
            "content_id": f"C{i+1:04d}",
            "title": title,
            "genre": genre,
            "release_year": release_year,
            "duration_min": duration,
            "_quality": quality,
        })
    return pd.DataFrame(rows)


# -----------------------------------------------------------------
# 2. USERS (core attributes + latent engagement propensity)
# -----------------------------------------------------------------
def gen_users():
    rows = []
    for i in range(1, N_USERS + 1):
        age = int(np.clip(RNG.normal(35, 11), 18, 72))
        country = RNG.choice(COUNTRIES)
        name = f"{RNG.choice(FIRST_NAMES)} {RNG.choice(LAST_NAMES)}"

        tenure_days = int(RNG.integers(30, 1100))
        signup_date = REF_DATE - timedelta(days=tenure_days)

        sub = RNG.choice(SUB_TYPES, p=[0.34, 0.33, 0.33])

        segment = RNG.choice(["casual", "regular", "power"], p=[0.40, 0.42, 0.18])
        base_prop = {"casual": -0.6, "regular": 0.15, "power": 1.0}[segment]
        propensity = float(np.clip(RNG.normal(base_prop, 0.55), -2.2, 2.6))

        support_tickets = int(RNG.poisson(0.35 + max(0, -propensity) * 0.5))
        num_devices = int(np.clip(RNG.poisson(1.2 + (sub == "Premium") * 0.8), 1, 5))

        rows.append({
            "User_ID": i,
            "Name": name,
            "Age": age,
            "Country": country,
            "Subscription_Type": sub,
            "Signup_Date": signup_date.date().isoformat(),
            "Tenure_Days": tenure_days,
            "Support_Tickets": support_tickets,
            "Num_Devices": num_devices,
            "_propensity": propensity,
        })
    return pd.DataFrame(rows)


# -----------------------------------------------------------------
# 3. WATCH HISTORY (drives watch time, recency, favorite genre)
# -----------------------------------------------------------------
def gen_watch_history(users_df, content_df):
    all_rows = []
    watch_id = 1

    content_ids = content_df["content_id"].values
    content_pop = (content_df["_pop"] / content_df["_pop"].sum()).values
    content_duration = content_df["duration_min"].values
    content_quality = content_df["_quality"].values
    genre_to_idx = {g: i for i, g in enumerate(GENRES)}
    content_genre_idx = content_df["genre"].map(genre_to_idx).values
    n_content = len(content_df)

    days_since_login_map = {}

    for _, u in users_df.iterrows():
        prop = u["_propensity"]
        tenure = u["Tenure_Days"]

        weekly_rate = np.clip(0.05 + prop * 0.03, 0.002, 0.3)
        expected_sessions = weekly_rate * (tenure / 7)
        n_sessions = int(RNG.poisson(max(expected_sessions, 0.05)))
        n_sessions = min(n_sessions, 60)

        recency_scale = np.clip(6 - prop * 9, 2, 90)
        days_since_login = int(np.clip(RNG.exponential(recency_scale), 0, tenure))
        days_since_login_map[u["User_ID"]] = days_since_login

        if n_sessions == 0:
            continue

        last_active_date = REF_DATE - timedelta(days=days_since_login)
        signup_date = pd.Timestamp(u["Signup_Date"])

        affinity = RNG.dirichlet(np.ones(len(GENRES)) * 1.5)          # len == len(GENRES)
        genre_weight_per_content = affinity[content_genre_idx]         # vectorized, no pandas
        combined_weight = content_pop * genre_weight_per_content
        combined_weight = combined_weight / combined_weight.sum()

        span_days = max((last_active_date - signup_date).days, 1)
        session_offsets = np.sort(RNG.integers(0, span_days + 1, size=n_sessions))
        chosen_idx = RNG.choice(n_content, size=n_sessions, p=combined_weight)

        durations = content_duration[chosen_idx]
        qualities = content_quality[chosen_idx]
        cids = content_ids[chosen_idx]

        completion_logit = 0.6 * prop + 0.5 * qualities + RNG.normal(0, 0.9, size=n_sessions)
        completion_rate = np.clip(45 + completion_logit * 18, 3, 100)
        session_duration = np.round(durations * (completion_rate / 100), 1)

        uid = u["User_ID"]
        for k in range(n_sessions):
            watch_date = signup_date + timedelta(days=int(session_offsets[k]))
            all_rows.append((
                watch_id, uid, cids[k], watch_date.date().isoformat(),
                float(session_duration[k]), round(float(completion_rate[k]), 2)
            ))
            watch_id += 1

    watch_df = pd.DataFrame(all_rows, columns=[
        "watch_id", "user_id", "content_id", "watch_date", "session_duration", "completion_rate"
    ])
    return watch_df, days_since_login_map


# -----------------------------------------------------------------
# 4. RATINGS (subset of sessions, correlated with completion + quality)
# -----------------------------------------------------------------
def gen_ratings(watch_df, content_df):
    content_lookup = content_df.set_index("content_id")
    rate_mask = RNG.random(len(watch_df)) < 0.40   # ~40% of sessions get rated
    rated = watch_df[rate_mask].copy()

    quality = content_lookup.loc[rated["content_id"], "_quality"].values
    comp = rated["completion_rate"].values
    score_logit = 0.55 * quality + 0.012 * (comp - 50) + RNG.normal(0, 0.7, size=len(rated))
    raw_score = np.clip(3 + score_logit, 1, 5)
    rating = np.clip(np.round(raw_score), 1, 5).astype(int)

    ratings = pd.DataFrame({
        "user_id": rated["user_id"].values,
        "content_id": rated["content_id"].values,
        "rating": rating,
    })
    return ratings


# -----------------------------------------------------------------
# 5. CHURN (noisy logistic function of multiple weighted signals)
# -----------------------------------------------------------------
def gen_churn(users_df, watch_df, days_since_login_map):
    sess_stats = watch_df.groupby("user_id").agg(
        total_hours=("session_duration", lambda x: x.sum() / 60),
        avg_completion=("completion_rate", "mean"),
        n_sessions=("watch_id", "size"),
    )
    df = users_df.set_index("User_ID").join(sess_stats)
    df["total_hours"] = df["total_hours"].fillna(0.0)
    df["avg_completion"] = df["avg_completion"].fillna(30.0)
    df["n_sessions"] = df["n_sessions"].fillna(0)
    df["days_since_login"] = pd.Series(df.index.map(days_since_login_map), index=df.index).fillna(df["Tenure_Days"])

    def z(s):
        return (s - s.mean()) / (s.std() + 1e-9)

    z_recency = z(df["days_since_login"])
    z_watch = z(df["total_hours"])
    z_tenure = z(df["Tenure_Days"])
    z_tickets = z(df["Support_Tickets"])
    z_completion = z(df["avg_completion"])
    z_age = z(df["Age"])

    sub_effect = df["Subscription_Type"].map({"Basic": 0.05, "Standard": -0.03, "Premium": -0.10})
    genre_noise = RNG.normal(0, 0.06, size=len(df))  # tiny genre-level noise, ~irrelevant

    logit = (
        -1.60
        + 1.55 * z_recency
        - 1.05 * z_watch
        - 0.30 * z_tenure
        + 0.28 * z_tickets
        - 0.22 * z_completion
        + 0.03 * z_age
        + sub_effect.values
        + genre_noise
        + RNG.normal(0, 0.65, size=len(df))   # unobserved heterogeneity
    )
    prob = 1 / (1 + np.exp(-logit))
    churn = (RNG.random(len(df)) < prob).astype(int)

    df["Churn"] = churn
    df["Days_Since_Login"] = df["days_since_login"].astype(int)
    df["Watch_Time_Hours"] = df["total_hours"].round(2)
    return df.reset_index()


# -----------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------
def main():
    content = gen_content()
    genre_weight = {g: w for g, w in zip(GENRES, RNG.dirichlet(np.ones(len(GENRES)) * 18))}
    content["_pop"] = content["genre"].map(genre_weight) * np.exp(content["_quality"] * 0.3)

    users = gen_users()
    watch, days_map = gen_watch_history(users, content)
    ratings = gen_ratings(watch, content)
    users_full = gen_churn(users, watch, days_map)

    # derive Favorite_Genre from ACTUAL watch behavior (mode genre per user)
    wc = watch.merge(content[["content_id", "genre"]], on="content_id", how="left")
    fav = wc.groupby("user_id")["genre"].agg(lambda s: s.value_counts().idxmax())
    users_full["Favorite_Genre"] = users_full["User_ID"].map(fav)
    # users with zero sessions (rare) get a random genre fallback
    missing = users_full["Favorite_Genre"].isna()
    users_full.loc[missing, "Favorite_Genre"] = RNG.choice(GENRES, size=missing.sum())

    last_login_date = (REF_DATE - pd.to_timedelta(users_full["Days_Since_Login"], unit="D")).dt.date.astype(str)
    users_full["Last_Login"] = last_login_date

    users_out = users_full[[
        "User_ID", "Name", "Age", "Country", "Subscription_Type", "Signup_Date",
        "Tenure_Days", "Watch_Time_Hours", "Favorite_Genre", "Last_Login",
        "Days_Since_Login", "Support_Tickets", "Num_Devices", "Churn"
    ]].copy()

    content_out = content.drop(columns=["_quality", "_pop"], errors="ignore")
    watch_out = watch[["watch_id", "user_id", "content_id", "watch_date", "session_duration", "completion_rate"]]
    ratings_out = ratings[["user_id", "content_id", "rating"]].copy()
    ratings_out.insert(0, "rating_id", range(1, len(ratings_out) + 1))

    _here = os.path.dirname(os.path.abspath(__file__))
    users_out.to_csv(os.path.join(_here, "users_with_churn.csv"), index=False)
    watch_out.to_csv(os.path.join(_here, "watch_history.csv"), index=False)
    ratings_out.to_csv(os.path.join(_here, "ratings.csv"), index=False)
    content_out.to_csv(os.path.join(_here, "content.csv"), index=False)

    print("users:", len(users_out))
    print("watch_history:", len(watch_out))
    print("ratings:", len(ratings_out))
    print("content:", len(content_out))
    print("\nchurn rate:", round(users_out["Churn"].mean() * 100, 2), "%")
    print(users_out.head(3).to_string())


if __name__ == "__main__":
    main()
