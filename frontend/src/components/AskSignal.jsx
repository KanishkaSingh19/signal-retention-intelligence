import { useState, useRef, useEffect } from "react";
import { api } from "../api.js";

const SUGGESTIONS = [
  "What's the overall churn rate?",
  "Which country has the highest churn?",
  "How does churn differ between subscription plans?",
  "What's the churn rate for users with 3 or more support tickets?",
  "Which genre has the best average rating?",
  "How does churn change with account tenure?",
];

export default function AskSignal() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function ask(question) {
    if (!question.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const data = await api.ask(question);
      setMessages((m) => [...m, { role: "assistant", text: data.answer, queries: data.queries }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "error", text: `${err.message}${api.base.includes("localhost") ? ` (backend at ${api.base} running?)` : ""}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-wrap">
      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="serif" style={{ fontSize: 20, color: "var(--text)", marginBottom: 10 }}>Ask Signal</div>
            <div>Ask a question in plain English. The AI writes and runs real SQL against the actual database — every answer is grounded in the real numbers, not guessed.</div>
          </div>
        )}
        {messages.map((m, i) => (
          <div className={`chat-msg ${m.role}`} key={i}>
            <div>{m.text}</div>
            {m.queries?.length > 0 && (
              <div className="chat-sql">
                {m.queries.map((q, j) => (
                  <div key={j} style={{ marginBottom: j < m.queries.length - 1 ? 8 : 0 }}>
                    {q.sql}
                    <div style={{ color: "var(--muted-2)", marginTop: 2 }}>→ {q.row_count} row(s)</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-msg assistant">
            <span className="typing-dots"><span /><span /><span /></span>
          </div>
        )}
      </div>

      {messages.length === 0 && (
        <div className="chat-suggestions">
          {SUGGESTIONS.map((s) => (
            <button className="chat-suggestion" key={s} onClick={() => ask(s)}>{s}</button>
          ))}
        </div>
      )}

      <div className="chat-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(input)}
          placeholder="Ask about churn, users, content, or engagement..."
          disabled={loading}
        />
        <button onClick={() => ask(input)} disabled={loading || !input.trim()}>Ask</button>
      </div>
    </div>
  );
}
