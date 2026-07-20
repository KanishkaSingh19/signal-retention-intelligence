/**
 * sqlGuard.js
 * ------------
 * Safety layer between LLM-generated SQL and the PostgreSQL database.
 *
 * The model is untrusted input as far as SQL execution is concerned --
 * even with a careful system prompt, we don't execute anything it writes
 * without validating it first. This is the same principle as sanitizing
 * user input, just applied to LLM output instead.
 *
 * Rules enforced:
 *   1. Must be a single statement (no ';' separated multi-statements).
 *   2. Must start with SELECT or WITH (read-only CTEs allowed).
 *   3. Must not contain any DDL/DML or admin keywords (INSERT, UPDATE,
 *      DELETE, DROP, COPY, GRANT, etc.), checked as whole words so e.g. a
 *      column named "updated_at" doesn't trip the UPDATE check.
 *   4. Must only reference the 4 known tables (users, content,
 *      watch_history, ratings) -- this also blocks pg_catalog and
 *      information_schema, since those show up as unknown table refs.
 *   5. Adds a LIMIT cap if the query doesn't already have one, so a
 *      broad query can't return the entire 100K-row table into the
 *      model's context.
 *
 * This runs alongside a read-only transaction (BEGIN TRANSACTION READ ONLY)
 * in server.js, so even a query that somehow slipped past these checks
 * still could not mutate the database.
 */

const FORBIDDEN_KEYWORDS = [
  "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE",
  "REPLACE", "TRUNCATE", "VACUUM", "ATTACH", "DETACH",
  "PRAGMA", "REINDEX", "EXEC", "EXECUTE",
  "COPY", "GRANT", "REVOKE", "MERGE", "CALL", "DO",
];

const ALLOWED_TABLES = ["users", "content", "watch_history", "ratings"];
const DEFAULT_LIMIT = 500;

export function validateSql(rawSql) {
  const sql = rawSql.trim().replace(/;+\s*$/g, ""); // drop trailing semicolon(s)

  if (sql.includes(";")) {
    throw new Error("Multiple statements are not allowed.");
  }

  const upper = sql.toUpperCase();
  if (!/^\s*(SELECT|WITH)\b/.test(upper)) {
    throw new Error("Only SELECT / WITH (read-only) queries are allowed.");
  }

  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, "i");
    if (re.test(sql)) {
      throw new Error(`Forbidden keyword detected: ${kw}`);
    }
  }

  // CTE aliases (WITH foo AS (...), bar AS (...)) are legitimate table-like
  // references and must be allowed alongside the real tables.
  const cteNames = [...sql.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s*\(/gi)]
    .map((m) => m[1].toLowerCase());
  const allowed = new Set([...ALLOWED_TABLES, ...cteNames]);

  const tableRefs = [...sql.matchAll(/\b(FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi)]
    .map((m) => m[2].toLowerCase());
  for (const t of tableRefs) {
    if (!allowed.has(t)) {
      throw new Error(`Query references an unknown table: ${t}`);
    }
  }

  let finalSql = sql;
  if (!/\bLIMIT\s+\d+/i.test(finalSql)) {
    finalSql = `${finalSql}\nLIMIT ${DEFAULT_LIMIT}`;
  }

  return finalSql;
}
