"use client";

import { useEffect, useRef, useState } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "What submissions do I keep getting caught in?",
  "What have I been drilling lately?",
  "How's my training volume trending?",
  "What should I work on next?",
];

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setError(null);
    setInput("");
    setBusy(true);

    const outgoing: ChatMessage[] = [
      ...messages,
      { role: "user", content: question },
    ];
    // Placeholder assistant message that streaming fills in.
    setMessages([...outgoing, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: outgoing }),
      });
      if (!res.ok || !res.body) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        const snapshot = answer;
        setMessages([...outgoing, { role: "assistant", content: snapshot }]);
      }
      if (!answer) {
        setMessages(outgoing);
        throw new Error("Coach didn't reply — try again.");
      }
    } catch (e) {
      // Drop the empty placeholder so the user can retry cleanly.
      setMessages((cur) =>
        cur.length && cur[cur.length - 1].content === "" ? outgoing : cur,
      );
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div
        ref={scrollRef}
        className="rounded-sm bg-paper-raised border border-paper-line p-5 h-[28rem] overflow-y-auto space-y-4"
      >
        {messages.length === 0 && (
          <div>
            <p className="text-sm text-ink-mute font-mono">
              Try one of these:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STARTERS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-left text-sm text-ink-dim border border-paper-line rounded-sm px-3 py-2 hover:border-accent hover:text-ink transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex"}
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-sm bg-accent/10 border border-accent/30 px-3 py-2 text-sm text-ink whitespace-pre-wrap"
                  : "max-w-[85%] rounded-sm bg-paper border border-paper-line px-3 py-2 text-sm text-ink whitespace-pre-wrap"
              }
            >
              {m.content || (
                <span className="text-ink-mute font-mono text-xs">
                  thinking…
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-sm text-accent-deep font-mono">{error}</p>
      )}

      <form
        className="mt-4 flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your training…"
          disabled={busy}
          className="flex-1 bg-paper border border-paper-line rounded-sm px-3 py-2.5 text-ink placeholder:text-ink-mute focus:outline-none focus:border-accent transition disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="bg-accent text-paper px-5 py-2.5 rounded-sm font-medium hover:bg-accent-deep transition disabled:opacity-50"
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
