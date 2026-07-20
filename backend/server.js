/**
 * server.js
 * ----------
 * Express backend for the Signal Retention Intelligence app.
 *
 * Data endpoints:
 *   GET  /api/stats             -> precomputed dashboard JSON
 *   GET  /api/high-risk-users   -> a page of the highest-risk users (from Postgres)
 *
 * AI endpoints (OpenAI, gpt-4o-mini by default):
 *   POST /api/ask               -> text-to-SQL agent. NL question -> the model
 *                                  writes SQL -> we run it (read-only, guarded)
 *                                  against Postgres -> the model answers from
 *                                  the real rows. Never invents numbers.
 *   POST /api/explain-user      -> given a user_id, the model reads that user's
 *                                  real stats and writes a plain-English churn-
 *                                  risk explanation for a retention manager.
 *   POST /api/winback-email     -> given a user_id, the model drafts a
 *                                  personalized win-back email based on that
 *                                  user's actual risk profile.
 *
 * The three AI routes are rate-limited (rateLimit.js) to protect the API key
 * on a public URL. Also set a hard spending cap in the OpenAI dashboard.
 *
 * Run: node server.js   (needs OPENAI_API_KEY and DATABASE_URL in .env)
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { validateSql } from "./sqlGuard.js";
import { chat, chatWithTools, OPENAI_MODEL } from "./openaiClient.js";
import { rateLimit } from "./rateLimit.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/retention";

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });
// In local dev the stats file lives at ../data/data.json. In the container we
// copy it next to server.js, so check the local path first, then fall back.
const STATS_PATH = fs.existsSync(path.join(__dirname, "data.json"))
  ? path.join(__dirname, "data.json")
  : path.join(__dirname, "..", "data", "data.json");

const app = express();
app.use(cors());
app.use(express.json());

// =================================================================
// Helpers
// =================================================================

// Run a read-only query in a read-only transaction (defense in depth).
async function runReadOnly(sql, params = []) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN TRANSACTION READ ONLY");
    const r = await c.query(sql, params);
    await c.query("COMMIT");
    return r.rows;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

// A behavioral risk proxy computed in SQL (mirrors the analysis logic):
// higher = riskier. Used to rank users and to give the LLM context.
const RISK_SELECT = `
  SELECT
    user_id, name, age, country, subscription_type, tenure_days,
    watch_time_hours, favorite_genre, days_since_login, support_tickets,
    num_devices, churn,
    ROUND(
      (
        (days_since_login::numeric / NULLIF((SELECT MAX(days_since_login) FROM users), 0)::numeric)
        - (watch_time_hours::numeric / NULLIF((SELECT MAX(watch_time_hours) FROM users), 0)::numeric)
      )::numeric
    , 4) AS risk_proxy
  FROM users
`;

async function getUserById(userId) {
  const rows = await runReadOnly(
    `${RISK_SELECT} WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

function userFactSheet(u) {
  // Compact, factual context handed to the LLM. Keeping it structured and
  // explicit keeps the model grounded and cheap (few tokens).
  return [
    `user_id: ${u.user_id}`,
    `name: ${u.name}`,
    `age: ${u.age}`,
    `country: ${u.country}`,
    `subscription_type: ${u.subscription_type}`,
    `tenure_days: ${u.tenure_days} (account age)`,
    `days_since_login: ${u.days_since_login} (higher = more inactive)`,
    `watch_time_hours: ${u.watch_time_hours} (lifetime; lower = less engaged)`,
    `favorite_genre: ${u.favorite_genre}`,
    `support_tickets: ${u.support_tickets} (more tickets correlate with churn)`,
    `num_devices: ${u.num_devices}`,
    `churn_label_in_data: ${u.churn} (1 = churned, 0 = retained)`,
  ].join("\n");
}

// Reference base rates so the model's explanations are calibrated, not vague.
const DOMAIN_CONTEXT = `
Reference facts about this platform (use to calibrate risk language):
- Overall churn rate is ~27%.
- The two strongest churn drivers are days_since_login (inactivity) and low
  watch_time_hours (low engagement). These matter far more than demographics.
- New accounts churn much more: ~44% in the first 90 days vs ~18% after 2+ years.
- Support tickets escalate risk: 0 tickets ~21% churn, 3+ tickets ~57%.
- Country, age, and subscription tier have little effect on churn.
`.trim();

// =================================================================
// GET /api/stats
// =================================================================
app.get("/api/stats", (req, res) => {
  try {
    res.json(JSON.parse(fs.readFileSync(STATS_PATH, "utf-8")));
  } catch (err) {
    res.status(500).json({ error: "Could not load stats.", detail: err.message });
  }
});

// =================================================================
// GET /api/high-risk-users  -> top N users by risk proxy
// =================================================================
app.get("/api/high-risk-users", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  try {
    const rows = await runReadOnly(
      `${RISK_SELECT} ORDER BY risk_proxy DESC LIMIT $1`,
      [limit]
    );
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
// POST /api/ask  -> text-to-SQL agent (OpenAI tool calling)
// =================================================================

const SCHEMA_DESCRIPTION = `
You have access to a PostgreSQL database with 4 tables describing a
subscription streaming platform (snapshot date 2026-06-30).

users(user_id INT pk, name TEXT, age INT, country TEXT, subscription_type TEXT
  [Basic|Standard|Premium], signup_date DATE, tenure_days INT,
  watch_time_hours DOUBLE PRECISION, favorite_genre TEXT, last_login DATE,
  days_since_login INT, support_tickets INT, num_devices INT,
  churn SMALLINT [1=churned,0=retained])
content(content_id TEXT pk, title TEXT, genre TEXT, release_year INT, duration_min INT)
watch_history(watch_id INT pk, user_id INT, content_id TEXT, watch_date DATE,
  session_duration DOUBLE PRECISION, completion_rate DOUBLE PRECISION [0-100])
ratings(rating_id INT pk, user_id INT, content_id TEXT, rating SMALLINT [1-5])
`.trim();

const RUN_SQL_TOOL = {
  type: "function",
  function: {
    name: "run_sql_query",
    description:
      "Execute a read-only SQL SELECT query (PostgreSQL) against the streaming " +
      "platform database and return rows. Only SELECT/WITH allowed. Use this " +
      "to get real numbers -- never invent a statistic without querying.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "A single read-only PostgreSQL SELECT query." },
      },
      required: ["query"],
    },
  },
};

async function runSqlTool(query) {
  const safeSql = validateSql(query);
  const rows = await runReadOnly(safeSql);
  return { sql_executed: safeSql, row_count: rows.length, rows: rows.slice(0, 200) };
}

app.post("/api/ask", rateLimit, async (req, res) => {
  const { question } = req.body || {};
  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "Missing 'question' string." });
  }

  const messages = [
    {
      role: "system",
      content:
        `You are a data analyst assistant for a streaming platform's retention team.\n${SCHEMA_DESCRIPTION}\n\n` +
        "Answer by writing and running SQL with the run_sql_query tool. Ground every " +
        "answer in the actual rows returned -- cite the real numbers. If the schema can't " +
        "answer it, say so. Keep the final answer to 2-4 business-readable sentences.",
    },
    { role: "user", content: question },
  ];

  const queriesRun = [];
  const MAX_TURNS = 4;

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const msg = await chatWithTools(messages, [RUN_SQL_TOOL]);
      if (!msg) return res.status(500).json({ error: "No response from model." });

      const toolCalls = msg.tool_calls || [];
      if (toolCalls.length === 0) {
        return res.json({ answer: (msg.content || "").trim(), queries: queriesRun });
      }

      // record the assistant turn (with its tool calls) before answering them
      messages.push(msg);

      for (const call of toolCalls) {
        let resultStr;
        try {
          const args = JSON.parse(call.function.arguments || "{}");
          const result = await runSqlTool(args.query);
          queriesRun.push({ sql: result.sql_executed, row_count: result.row_count });
          resultStr = JSON.stringify(result);
        } catch (err) {
          resultStr = JSON.stringify({ error: err.message });
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: resultStr,
        });
      }
    }
    return res.status(500).json({ error: "Exceeded reasoning turns without a final answer." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// =================================================================
// POST /api/explain-user  -> AI churn-risk explanation for one user
// =================================================================
app.post("/api/explain-user", rateLimit, async (req, res) => {
  const { user_id } = req.body || {};
  if (user_id === undefined) {
    return res.status(400).json({ error: "Missing 'user_id'." });
  }
  try {
    const user = await getUserById(Number(user_id));
    if (!user) return res.status(404).json({ error: `No user with id ${user_id}.` });

    const answer = await chat(
      [
        {
          role: "system",
          content:
            "You are a retention analyst. Given one user's real stats, explain in plain " +
            "English why they are or aren't at risk of churning, and name the 2-3 factors " +
            "driving that. Be specific and reference their actual numbers. 3-4 sentences. " +
            "No fluff, no bullet points, no invented data.\n\n" + DOMAIN_CONTEXT,
        },
        { role: "user", content: `Here is the user:\n${userFactSheet(user)}\n\nExplain their churn risk.` },
      ],
      { temperature: 0.3, maxTokens: 260 }
    );

    res.json({ user_id: user.user_id, name: user.name, explanation: answer, stats: user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
// POST /api/winback-email  -> AI-drafted personalized retention email
// =================================================================
app.post("/api/winback-email", rateLimit, async (req, res) => {
  const { user_id, tone } = req.body || {};
  if (user_id === undefined) {
    return res.status(400).json({ error: "Missing 'user_id'." });
  }
  try {
    const user = await getUserById(Number(user_id));
    if (!user) return res.status(404).json({ error: `No user with id ${user_id}.` });

    const styleNote =
      tone === "playful"
        ? "Tone: warm and playful, but still professional."
        : "Tone: friendly, concise, professional.";

    const answer = await chat(
      [
        {
          role: "system",
          content:
            "You write short win-back emails for a streaming service's retention team. " +
            "Use the user's real profile to make it relevant (e.g. reference their favorite " +
            "genre, acknowledge inactivity gently, offer a reason to return). Do NOT mention " +
            "internal metrics like 'churn score', 'risk', or 'days_since_login' to the user. " +
            "Return a subject line and a 4-6 sentence body. " + styleNote,
        },
        { role: "user", content: `User profile:\n${userFactSheet(user)}\n\nWrite the win-back email.` },
      ],
      { temperature: 0.7, maxTokens: 320 }
    );

    res.json({ user_id: user.user_id, name: user.name, email: answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================================================================
app.get("/api/health", (req, res) =>
  res.json({ ok: true, model: OPENAI_MODEL, ai_enabled: Boolean(process.env.OPENAI_API_KEY) })
);

app.listen(PORT, () => {
  console.log(`Signal backend running on http://localhost:${PORT}`);
  console.log(`  DB: ${DATABASE_URL.replace(/\/\/[^@]*@/, "//***@")}`);
  console.log(`  AI model: ${OPENAI_MODEL}`);
  console.log(`  OPENAI_API_KEY set: ${Boolean(process.env.OPENAI_API_KEY)}`);
});
