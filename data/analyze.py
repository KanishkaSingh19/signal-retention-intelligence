import pandas as pd
import numpy as np
import json
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, accuracy_score, precision_score, recall_score

import os
# Data source: if DATABASE_URL is set AND pandas can reach it, read the four
# tables straight from Postgres (so the analysis runs off the same database
# the app queries). Otherwise fall back to the CSVs in ../sql. Both paths
# produce identical dataframes, so the rest of the script is unchanged.
_HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(_HERE, "..", "sql")


def _load_tables():
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        try:
            import sqlalchemy
            engine = sqlalchemy.create_engine(db_url)
            u = pd.read_sql("SELECT * FROM users", engine)
            w = pd.read_sql("SELECT * FROM watch_history", engine)
            r = pd.read_sql("SELECT * FROM ratings", engine)
            c = pd.read_sql("SELECT * FROM content", engine)
            # normalize column names to match the CSV capitalization the rest
            # of this script expects
            u = u.rename(columns={
                "user_id": "User_ID", "name": "Name", "age": "Age",
                "country": "Country", "subscription_type": "Subscription_Type",
                "signup_date": "Signup_Date", "tenure_days": "Tenure_Days",
                "watch_time_hours": "Watch_Time_Hours", "favorite_genre": "Favorite_Genre",
                "last_login": "Last_Login", "days_since_login": "Days_Since_Login",
                "support_tickets": "Support_Tickets", "num_devices": "Num_Devices",
                "churn": "Churn",
            })
            print("Loaded data from Postgres.")
            return u, w, r, c
        except Exception as e:
            print(f"Postgres load failed ({e}); falling back to CSVs.")
    u = pd.read_csv(f"{BASE}/users_with_churn.csv")
    w = pd.read_csv(f"{BASE}/watch_history.csv")
    r = pd.read_csv(f"{BASE}/ratings.csv")
    c = pd.read_csv(f"{BASE}/content.csv")
    return u, w, r, c


users, watch, ratings, content = _load_tables()

out = {}

# ---------- TOP LINE KPIs ----------
out["total_users"] = int(len(users))
out["churn_rate"] = round(users["Churn"].mean() * 100, 2)
out["avg_watch_time"] = round(users["Watch_Time_Hours"].mean(), 2)
out["countries"] = int(users["Country"].nunique())
out["total_sessions"] = int(len(watch))
out["total_ratings"] = int(len(ratings))
out["total_titles"] = int(len(content))
out["avg_rating"] = round(ratings["rating"].mean(), 2)
out["avg_completion_rate"] = round(watch["completion_rate"].mean(), 1)
out["avg_tenure_days"] = round(users["Tenure_Days"].mean(), 0)
out["avg_support_tickets"] = round(users["Support_Tickets"].mean(), 2)

# ---------- CHURN BY SEGMENT (demographic parity check) ----------
out["churn_by_subscription"] = users.groupby("Subscription_Type")["Churn"].mean().mul(100).round(2).to_dict()
out["users_by_subscription"] = users["Subscription_Type"].value_counts().to_dict()

out["churn_by_country"] = users.groupby("Country")["Churn"].mean().mul(100).round(2).sort_values(ascending=False).to_dict()
out["users_by_country"] = users["Country"].value_counts().to_dict()

out["churn_by_genre"] = users.groupby("Favorite_Genre")["Churn"].mean().mul(100).round(2).sort_values(ascending=False).to_dict()

users["age_band"] = pd.cut(users["Age"], bins=[17, 24, 34, 44, 54, 100], labels=["18-24", "25-34", "35-44", "45-54", "55+"])
out["churn_by_age_band"] = users.groupby("age_band", observed=True)["Churn"].mean().mul(100).round(2).to_dict()

# ---------- BEHAVIORAL DRIVERS (real signal) ----------
users["recency_band"] = pd.cut(users["Days_Since_Login"], bins=[-1, 2, 5, 10, 20, 40, 1000],
                                labels=["0-2d", "3-5d", "6-10d", "11-20d", "21-40d", "40d+"])
out["churn_by_recency_band"] = users.groupby("recency_band", observed=True)["Churn"].mean().mul(100).round(2).to_dict()

users["watch_band"] = pd.cut(users["Watch_Time_Hours"], bins=[-1, 1, 2.5, 5, 10, 1000],
                              labels=["0-1 hr", "1-2.5 hrs", "2.5-5 hrs", "5-10 hrs", "10+ hrs"])
out["churn_by_watch_band"] = users.groupby("watch_band", observed=True)["Churn"].mean().mul(100).round(2).to_dict()

users["ticket_band"] = pd.cut(users["Support_Tickets"], bins=[-1, 0, 1, 2, 100], labels=["0", "1", "2", "3+"])
out["churn_by_support_tickets"] = users.groupby("ticket_band", observed=True)["Churn"].mean().mul(100).round(2).to_dict()

users["tenure_band"] = pd.cut(users["Tenure_Days"], bins=[0, 90, 180, 365, 730, 1200],
                               labels=["0-90d", "91-180d", "181-365d", "1-2yr", "2yr+"])
out["churn_by_tenure_band"] = users.groupby("tenure_band", observed=True)["Churn"].mean().mul(100).round(2).to_dict()

# continuous curves for line charts
def curve(series, churn, bins):
    rows = []
    for lo, hi in zip(bins[:-1], bins[1:]):
        mask = (series >= lo) & (series < hi)
        if mask.sum() > 0:
            rows.append({"x": lo, "churn_rate": round(float(churn[mask].mean() * 100), 1), "n": int(mask.sum())})
    return rows

recency_bins = list(range(0, 60, 3)) + [1000]
out["recency_curve"] = curve(users["Days_Since_Login"], users["Churn"], recency_bins)

watch_bins = list(np.arange(0, 20, 1)) + [1000]
out["watch_time_curve"] = curve(users["Watch_Time_Hours"], users["Churn"], watch_bins)

# ---------- CHURN DRIVER MODEL ----------
model_df = pd.get_dummies(users, columns=["Subscription_Type", "Favorite_Genre", "Country"], drop_first=True)
feature_cols = ["Age", "Tenure_Days", "Watch_Time_Hours", "Days_Since_Login", "Support_Tickets", "Num_Devices"] + \
    [c for c in model_df.columns if c.startswith(("Subscription_Type_", "Favorite_Genre_", "Country_"))]
X = model_df[feature_cols]
y = model_df["Churn"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=1, stratify=y)
scaler = StandardScaler().fit(X_train)
clf = LogisticRegression(max_iter=1000)
clf.fit(scaler.transform(X_train), y_train)
proba_test = clf.predict_proba(scaler.transform(X_test))[:, 1]
pred_test = clf.predict(scaler.transform(X_test))

out["model_auc"] = round(float(roc_auc_score(y_test, proba_test)), 3)
out["model_accuracy"] = round(float(accuracy_score(y_test, pred_test)) * 100, 1)
out["model_precision"] = round(float(precision_score(y_test, pred_test)) * 100, 1)
out["model_recall"] = round(float(recall_score(y_test, pred_test)) * 100, 1)

coefs = dict(zip(feature_cols, clf.coef_[0]))
coefs_sorted = dict(sorted(coefs.items(), key=lambda x: -abs(x[1]))[:10])
out["churn_driver_coefs"] = {k: round(float(v), 3) for k, v in coefs_sorted.items()}

# ---------- RISK DECILES (lift / gains chart -- the new headline visual) ----------
all_proba = clf.predict_proba(scaler.transform(X))[:, 1]
decile_df = pd.DataFrame({"proba": all_proba, "churn": y.values})
decile_df["decile"] = pd.qcut(decile_df["proba"], 10, labels=False, duplicates="drop") + 1
decile_summary = decile_df.groupby("decile").agg(
    n=("churn", "size"), churn_rate=("churn", "mean"), avg_score=("proba", "mean")
).reset_index()
decile_summary["churn_rate"] = (decile_summary["churn_rate"] * 100).round(1)
decile_summary["avg_score"] = (decile_summary["avg_score"] * 100).round(1)
out["risk_deciles"] = decile_summary.to_dict(orient="records")

# top decile capture rate (how much of all churn is concentrated in top 2 deciles)
total_churners = y.sum()
top2_churners = decile_df[decile_df["decile"] >= 9]["churn"].sum()
out["top2decile_capture_pct"] = round(float(top2_churners / total_churners) * 100, 1)
out["top2decile_share_of_base"] = round(float((decile_df["decile"] >= 9).mean()) * 100, 1)

# ---------- CONTENT ANALYTICS ----------
watch_content = watch.merge(content, on="content_id", how="left")
out["genre_views"] = watch_content.groupby("genre").size().sort_values(ascending=False).to_dict()
out["genre_completion"] = watch_content.groupby("genre")["completion_rate"].mean().round(1).sort_values(ascending=False).to_dict()

rating_counts = ratings.groupby("content_id").agg(avg_rating=("rating", "mean"), n=("rating", "size")).reset_index()
rating_counts = rating_counts.merge(content, on="content_id", how="left")
top_content = rating_counts[rating_counts["n"] >= 15].sort_values("avg_rating", ascending=False).head(10)
out["top_content"] = top_content[["title", "genre", "avg_rating", "n"]].round(2).to_dict(orient="records")

most_watched = watch_content.groupby(["content_id", "title", "genre"]).size().reset_index(name="views").sort_values("views", ascending=False).head(10)
out["most_watched_content"] = most_watched[["title", "genre", "views"]].to_dict(orient="records")

out["views_by_release_year"] = watch_content.groupby("release_year").size().sort_index().to_dict()

# ---------- GROWTH / TIME TRENDS ----------
watch["watch_date"] = pd.to_datetime(watch["watch_date"])
monthly = watch.groupby(watch["watch_date"].dt.to_period("M")).size()
out["monthly_sessions"] = {str(k): int(v) for k, v in monthly.items()}
monthly_completion = watch.groupby(watch["watch_date"].dt.to_period("M"))["completion_rate"].mean().round(1)
out["monthly_completion"] = {str(k): float(v) for k, v in monthly_completion.items()}
out["avg_session_duration"] = round(float(watch["session_duration"].mean()), 1)

with open(os.path.join(_HERE, "data.json"), "w") as f:
    json.dump(out, f, indent=2, default=str)

print("DONE")
print("churn_rate:", out["churn_rate"])
print("model_auc:", out["model_auc"], "acc:", out["model_accuracy"], "precision:", out["model_precision"], "recall:", out["model_recall"])
print("top2decile_capture_pct:", out["top2decile_capture_pct"], "share_of_base:", out["top2decile_share_of_base"])
print("driver coefs:", out["churn_driver_coefs"])
print("risk deciles:", out["risk_deciles"])
