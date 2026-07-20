-- schema.sql — Postgres schema for the Retention Intelligence database
-- Run automatically by load_pg.py, or manually:  psql -d retention -f schema.sql

DROP TABLE IF EXISTS ratings CASCADE;
DROP TABLE IF EXISTS watch_history CASCADE;
DROP TABLE IF EXISTS content CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    user_id           INTEGER PRIMARY KEY,
    name              TEXT,
    age               INTEGER,
    country           TEXT,
    subscription_type TEXT,
    signup_date       DATE,
    tenure_days       INTEGER,
    watch_time_hours  DOUBLE PRECISION,
    favorite_genre    TEXT,
    last_login        DATE,
    days_since_login  INTEGER,
    support_tickets   INTEGER,
    num_devices       INTEGER,
    churn             SMALLINT
);

CREATE TABLE content (
    content_id    TEXT PRIMARY KEY,
    title         TEXT,
    genre         TEXT,
    release_year  INTEGER,
    duration_min  INTEGER
);

CREATE TABLE watch_history (
    watch_id          INTEGER PRIMARY KEY,
    user_id           INTEGER REFERENCES users(user_id),
    content_id        TEXT REFERENCES content(content_id),
    watch_date        DATE,
    session_duration  DOUBLE PRECISION,
    completion_rate   DOUBLE PRECISION
);

CREATE TABLE ratings (
    rating_id   INTEGER PRIMARY KEY,
    user_id     INTEGER REFERENCES users(user_id),
    content_id  TEXT REFERENCES content(content_id),
    rating      SMALLINT
);

CREATE INDEX idx_watch_user     ON watch_history(user_id);
CREATE INDEX idx_watch_content  ON watch_history(content_id);
CREATE INDEX idx_ratings_user   ON ratings(user_id);
CREATE INDEX idx_ratings_content ON ratings(content_id);
CREATE INDEX idx_users_country  ON users(country);
CREATE INDEX idx_users_sub      ON users(subscription_type);
