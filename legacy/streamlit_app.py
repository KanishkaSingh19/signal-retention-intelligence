import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

# -----------------------
# PAGE CONFIG
# -----------------------

st.set_page_config(
    page_title="Product Analytics Platform",
    layout="wide"
)

# -----------------------
# LOAD DATA
# -----------------------

users = pd.read_csv("users_with_churn.csv")
watch = pd.read_csv("watch_history.csv")
ratings = pd.read_csv("ratings.csv")
content = pd.read_csv("content.csv")

watch_content = watch.merge(content, on="content_id", how="left")

# -----------------------
# SIDEBAR
# -----------------------

st.sidebar.title("Filters")

subscription = st.sidebar.multiselect(
    "Subscription Type",
    users["Subscription_Type"].unique(),
    default=users["Subscription_Type"].unique()
)

users = users[users["Subscription_Type"].isin(subscription)]
watch = watch[watch["user_id"].isin(users["User_ID"])]
watch_content = watch_content[watch_content["user_id"].isin(users["User_ID"])]
ratings = ratings[ratings["user_id"].isin(users["User_ID"])]

# -----------------------
# HEADER
# -----------------------

st.title("Product Analytics & User Retention Intelligence Platform")
st.caption(
    "25K users \u00b7 100K+ watch sessions \u00b7 40K ratings \u00b7 500 titles \u2014 "
    "built with SQL, Python, and Power BI/DAX. Churn is modeled with a noisy, "
    "multi-factor process, not a hand-set rule, so the signal below is realistic "
    "rather than a clean cliff."
)

# -----------------------
# KPI ROW
# -----------------------

col1, col2, col3, col4, col5 = st.columns(5)

with col1:
    st.metric("Total Users", f"{len(users):,}")
with col2:
    st.metric("Churn Rate", f"{users['Churn'].mean()*100:.2f}%")
with col3:
    st.metric("Avg Tenure", f"{users['Tenure_Days'].mean():.0f} days")
with col4:
    st.metric("Avg Support Tickets", f"{users['Support_Tickets'].mean():.2f}")
with col5:
    st.metric("Avg Session Completion", f"{watch['completion_rate'].mean():.1f}%")

st.divider()
tab1, tab2, tab3, tab4 = st.tabs(
    [
        "Executive Overview",
        "User Analytics",
        "Content Analytics",
        "Growth Analytics",
    ]
)

# =========================================================
# TAB 1 -- EXECUTIVE OVERVIEW
# =========================================================
with tab1:

    st.subheader("Churn Risk: Ranking Beats Thresholding")
    st.markdown(
        "A logistic regression is trained on demographics, tenure, support "
        "tickets, and behavior, then used to **rank** every user by predicted "
        "risk instead of applying a single hard cutoff. The result is a clean, "
        "monotonic lift curve: the riskiest 20% of users typically account for "
        "roughly half of all churn."
    )

    model_df = pd.get_dummies(
        users, columns=["Subscription_Type", "Favorite_Genre", "Country"], drop_first=True
    )
    feature_cols = ["Age", "Tenure_Days", "Watch_Time_Hours", "Days_Since_Login",
                     "Support_Tickets", "Num_Devices"] + [
        c for c in model_df.columns
        if c.startswith(("Subscription_Type_", "Favorite_Genre_", "Country_"))
    ]
    X = model_df[feature_cols]
    y = model_df["Churn"]

    if y.nunique() == 2 and len(users) > 200:
        scaler = StandardScaler().fit(X)
        clf = LogisticRegression(max_iter=1000).fit(scaler.transform(X), y)
        proba = clf.predict_proba(scaler.transform(X))[:, 1]

        decile_df = pd.DataFrame({"proba": proba, "churn": y.values})
        decile_df["decile"] = pd.qcut(decile_df["proba"], 10, labels=False, duplicates="drop") + 1
        decile_summary = (
            decile_df.groupby("decile")
            .agg(Users=("churn", "size"), Churn_Rate=("churn", "mean"))
            .reset_index()
        )
        decile_summary["Churn_Rate"] = (decile_summary["Churn_Rate"] * 100).round(1)
        decile_summary["Risk Decile"] = "D" + decile_summary["decile"].astype(str)

        c1, c2 = st.columns([1.4, 1])
        with c1:
            fig = px.bar(
                decile_summary,
                x="Risk Decile",
                y="Churn_Rate",
                text="Churn_Rate",
                labels={"Churn_Rate": "Actual Churn Rate (%)"},
                color="Churn_Rate",
                color_continuous_scale=["#56C2B4", "#E8A33D", "#E0636B"],
            )
            fig.update_traces(texttemplate="%{text}%", textposition="outside")
            fig.update_layout(coloraxis_showscale=False, height=340)
            st.plotly_chart(fig, use_container_width=True)
        with c2:
            top2 = decile_df[decile_df["decile"] >= 9]
            capture = top2["churn"].sum() / max(decile_df["churn"].sum(), 1) * 100
            st.metric("Top 20% of users capture", f"{capture:.1f}% of churn")
            st.dataframe(
                decile_summary[["Risk Decile", "Users", "Churn_Rate"]].rename(
                    columns={"Churn_Rate": "Churn Rate (%)"}
                ),
                use_container_width=True,
                hide_index=True,
            )
    else:
        st.info("Not enough data in the current filter selection to train the risk model.")

    st.subheader("Users by Subscription Plan")
    sub_counts = users["Subscription_Type"].value_counts().reset_index()
    sub_counts.columns = ["Subscription Type", "Users"]
    fig2 = px.pie(sub_counts, names="Subscription Type", values="Users", hole=0.45)
    st.plotly_chart(fig2, use_container_width=True)

# =========================================================
# TAB 2 -- USER ANALYTICS
# =========================================================
with tab2:

    st.subheader("Churn Rate by Days Since Last Login")
    recency_bins = pd.cut(
        users["Days_Since_Login"], bins=[-1, 2, 5, 10, 20, 40, 100000],
        labels=["0-2d", "3-5d", "6-10d", "11-20d", "21-40d", "40d+"]
    )
    churn_recency = (
        users.groupby(recency_bins, observed=True)["Churn"].mean().mul(100).round(2)
        .reset_index(name="Churn Rate (%)")
    )
    churn_recency.columns = ["Days Since Login", "Churn Rate (%)"]
    fig_r = px.bar(churn_recency, x="Days Since Login", y="Churn Rate (%)")
    st.plotly_chart(fig_r, use_container_width=True)

    st.subheader("Churn Rate by Account Tenure")
    tenure_bins = pd.cut(
        users["Tenure_Days"], bins=[0, 90, 180, 365, 730, 100000],
        labels=["0-90d", "91-180d", "181-365d", "1-2yr", "2yr+"]
    )
    churn_tenure = (
        users.groupby(tenure_bins, observed=True)["Churn"].mean().mul(100).round(2)
        .reset_index(name="Churn Rate (%)")
    )
    churn_tenure.columns = ["Tenure Band", "Churn Rate (%)"]
    fig_t = px.bar(churn_tenure, x="Tenure Band", y="Churn Rate (%)")
    st.plotly_chart(fig_t, use_container_width=True)

    st.subheader("Churn Rate by Support Ticket Count")
    ticket_bins = pd.cut(users["Support_Tickets"], bins=[-1, 0, 1, 2, 100], labels=["0", "1", "2", "3+"])
    churn_tickets = (
        users.groupby(ticket_bins, observed=True)["Churn"].mean().mul(100).round(2)
        .reset_index(name="Churn Rate (%)")
    )
    churn_tickets.columns = ["Support Tickets", "Churn Rate (%)"]
    fig_tk = px.bar(churn_tickets, x="Support Tickets", y="Churn Rate (%)")
    st.plotly_chart(fig_tk, use_container_width=True)

    st.subheader("Churn Rate by Country")
    churn_country = (
        users.groupby("Country")["Churn"].mean().mul(100).round(2)
        .reset_index(name="Churn Rate (%)").sort_values("Churn Rate (%)", ascending=True)
    )
    fig_c = px.bar(churn_country, x="Churn Rate (%)", y="Country", orientation="h")
    st.plotly_chart(fig_c, use_container_width=True)

# =========================================================
# TAB 3 -- CONTENT ANALYTICS
# =========================================================
with tab3:

    st.subheader("Content Consumption by Genre")
    genre_views = (
        watch_content.groupby("genre").size().reset_index(name="Views")
        .sort_values("Views", ascending=True)
    )
    fig = px.bar(genre_views, x="Views", y="genre", orientation="h")
    st.plotly_chart(fig, use_container_width=True)

    st.subheader("Average Completion Rate by Genre")
    genre_completion = (
        watch_content.groupby("genre")["completion_rate"].mean().round(1)
        .reset_index(name="Avg Completion (%)").sort_values("Avg Completion (%)", ascending=True)
    )
    fig_comp = px.bar(genre_completion, x="Avg Completion (%)", y="genre", orientation="h")
    st.plotly_chart(fig_comp, use_container_width=True)

    st.subheader("Top Rated Titles (min. 15 ratings)")
    rating_stats = (
        ratings.groupby("content_id")
        .agg(avg_rating=("rating", "mean"), num_ratings=("rating", "size"))
        .reset_index()
        .merge(content, on="content_id", how="left")
    )
    top_rated = (
        rating_stats[rating_stats["num_ratings"] >= 15]
        .sort_values("avg_rating", ascending=False)
        .head(10)[["title", "genre", "avg_rating", "num_ratings"]]
    )
    top_rated["avg_rating"] = top_rated["avg_rating"].round(2)
    st.dataframe(top_rated, use_container_width=True, hide_index=True)

# =========================================================
# TAB 4 -- GROWTH ANALYTICS
# =========================================================
with tab4:

    st.subheader("Monthly Watch Sessions")
    watch_month = watch.copy()
    watch_month["watch_date"] = pd.to_datetime(watch_month["watch_date"])
    monthly = (
        watch_month.groupby(watch_month["watch_date"].dt.to_period("M"))
        .size().reset_index(name="Sessions")
    )
    monthly["watch_date"] = monthly["watch_date"].astype(str)
    fig_m = px.line(monthly, x="watch_date", y="Sessions", markers=False)
    st.plotly_chart(fig_m, use_container_width=True)

    st.subheader("Monthly Average Completion Rate")
    monthly_completion = (
        watch_month.groupby(watch_month["watch_date"].dt.to_period("M"))["completion_rate"]
        .mean().round(1).reset_index(name="Avg Completion (%)")
    )
    monthly_completion["watch_date"] = monthly_completion["watch_date"].astype(str)
    fig_mc = px.line(monthly_completion, x="watch_date", y="Avg Completion (%)", markers=False)
    st.plotly_chart(fig_mc, use_container_width=True)

    st.subheader("Views by Content Release Year")
    year_views = (
        watch_content.groupby("release_year").size().reset_index(name="Views")
        .sort_values("release_year")
    )
    fig_y = px.bar(year_views, x="release_year", y="Views")
    st.plotly_chart(fig_y, use_container_width=True)
