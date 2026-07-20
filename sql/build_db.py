"""
build_db.py
------------
Loads the 4 CSVs into a real SQLite database (retention.db) with proper
types, primary keys, and foreign keys. This is what makes "I used SQL"
literally true -- queries run against an actual database engine, not
pandas operations shaped like SQL.

Run: python3 build_db.py
"""

import sqlite3
import csv
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "retention.db")
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.executescript("""
CREATE TABLE users (
    user_id           INTEGER PRIMARY KEY,
    name              TEXT,
    age               INTEGER,
    country           TEXT,
    subscription_type TEXT,
    signup_date       TEXT,
    tenure_days       INTEGER,
    watch_time_hours  REAL,
    favorite_genre    TEXT,
    last_login        TEXT,
    days_since_login  INTEGER,
    support_tickets   INTEGER,
    num_devices       INTEGER,
    churn             INTEGER
);

CREATE TABLE content (
    content_id     TEXT PRIMARY KEY,
    title          TEXT,
    genre          TEXT,
    release_year   INTEGER,
    duration_min   INTEGER
);

CREATE TABLE watch_history (
    watch_id          INTEGER PRIMARY KEY,
    user_id           INTEGER REFERENCES users(user_id),
    content_id        TEXT REFERENCES content(content_id),
    watch_date        TEXT,
    session_duration  REAL,
    completion_rate   REAL
);

CREATE TABLE ratings (
    rating_id   INTEGER PRIMARY KEY,
    user_id     INTEGER REFERENCES users(user_id),
    content_id  TEXT REFERENCES content(content_id),
    rating      INTEGER
);

CREATE INDEX idx_watch_user ON watch_history(user_id);
CREATE INDEX idx_watch_content ON watch_history(content_id);
CREATE INDEX idx_ratings_user ON ratings(user_id);
CREATE INDEX idx_ratings_content ON ratings(content_id);
CREATE INDEX idx_users_country ON users(country);
CREATE INDEX idx_users_sub ON users(subscription_type);
""")


def load_csv(path, table, columns):
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = [tuple(row[c] for c in columns) for row in reader]
    placeholders = ",".join(["?"] * len(columns))
    cur.executemany(f"INSERT INTO {table} VALUES ({placeholders})", rows)
    print(f"  loaded {len(rows):,} rows into {table}")


base = os.path.dirname(__file__)
print("Loading users...")
load_csv(f"{base}/users_with_churn.csv", "users", [
    "User_ID", "Name", "Age", "Country", "Subscription_Type", "Signup_Date",
    "Tenure_Days", "Watch_Time_Hours", "Favorite_Genre", "Last_Login",
    "Days_Since_Login", "Support_Tickets", "Num_Devices", "Churn"
])

print("Loading content...")
load_csv(f"{base}/content.csv", "content", [
    "content_id", "title", "genre", "release_year", "duration_min"
])

print("Loading watch_history...")
load_csv(f"{base}/watch_history.csv", "watch_history", [
    "watch_id", "user_id", "content_id", "watch_date", "session_duration", "completion_rate"
])

print("Loading ratings...")
load_csv(f"{base}/ratings.csv", "ratings", [
    "rating_id", "user_id", "content_id", "rating"
])

conn.commit()

# sanity check
for t in ["users", "content", "watch_history", "ratings"]:
    n = cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    print(f"{t}: {n:,} rows")

conn.close()
print(f"\nDatabase built at {DB_PATH}")
