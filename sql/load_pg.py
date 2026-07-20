"""
load_pg.py
-----------
Loads the 4 CSVs into a PostgreSQL database using the schema in schema.sql.
Uses COPY (via psycopg2's copy_expert) for fast bulk loading -- the standard
way to load bulk data into Postgres, much faster than row-by-row INSERTs.

Prereqs:
    pip install psycopg2-binary
    A running Postgres server and a database (default name: retention)

Configure the connection with a DATABASE_URL env var, e.g.:
    export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/retention"
or rely on the default below.

Run:
    createdb retention          # one-time, if it doesn't exist
    python3 load_pg.py
"""

import os
import csv
import io
import psycopg2

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/retention",
)

HERE = os.path.dirname(os.path.abspath(__file__))


def clean_copy(cur, csv_path, table, columns):
    """
    Stream a CSV into Postgres via COPY. We re-emit the CSV through an
    in-memory buffer so the column order exactly matches `columns` and
    empty strings become NULL.
    """
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        buf = io.StringIO()
        writer = csv.writer(buf)
        for row in reader:
            writer.writerow([row[c] for c in columns])
    buf.seek(0)

    col_list = ",".join(c.lower() for c in columns)
    copy_sql = (
        f"COPY {table} ({col_list}) FROM STDIN WITH (FORMAT csv, NULL '')"
    )
    cur.copy_expert(copy_sql, buf)
    print(f"  loaded {table}")


def main():
    print(f"Connecting to {DATABASE_URL.split('@')[-1]} ...")
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    print("Applying schema...")
    with open(os.path.join(HERE, "schema.sql"), encoding="utf-8") as f:
        cur.execute(f.read())

    print("Loading data via COPY...")
    clean_copy(cur, os.path.join(HERE, "users_with_churn.csv"), "users", [
        "User_ID", "Name", "Age", "Country", "Subscription_Type", "Signup_Date",
        "Tenure_Days", "Watch_Time_Hours", "Favorite_Genre", "Last_Login",
        "Days_Since_Login", "Support_Tickets", "Num_Devices", "Churn",
    ])
    clean_copy(cur, os.path.join(HERE, "content.csv"), "content", [
        "content_id", "title", "genre", "release_year", "duration_min",
    ])
    clean_copy(cur, os.path.join(HERE, "watch_history.csv"), "watch_history", [
        "watch_id", "user_id", "content_id", "watch_date", "session_duration", "completion_rate",
    ])
    clean_copy(cur, os.path.join(HERE, "ratings.csv"), "ratings", [
        "rating_id", "user_id", "content_id", "rating",
    ])

    conn.commit()

    for t in ["users", "content", "watch_history", "ratings"]:
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        print(f"{t}: {cur.fetchone()[0]:,} rows")

    cur.close()
    conn.close()
    print("\nPostgres database loaded successfully.")


if __name__ == "__main__":
    main()
