"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

export default function AgentPage() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/agent",
    }),
  });
  const [input, setInput] = useState("");
  const isLoading = status !== "ready";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <main className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">1claw AI Agent</h1>
        <p className="text-sm text-gray-500">
          Ask the agent to retrieve a secret from your vault.
        </p>
      </header>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-3 rounded-lg ${
              m.role === "user"
                ? "bg-blue-50 self-end text-right"
                : "bg-gray-100 self-start"
            }`}
          >
            <span className="text-xs font-semibold text-gray-400 uppercase">
              {m.role === "user" ? "You" : "Agent"}
            </span>
            <div className="mt-1 whitespace-pre-wrap">
              {m.parts
                .filter((part) => part.type === "text")
                .map((part, idx) => (
                  <span key={idx}>{part.text}</span>
                ))}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="bg-gray-100 p-3 rounded-lg animate-pulse text-gray-400">
            Agent is thinking…
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Try: "Retrieve the secret at api-keys/gemini"'
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </main>
  );
}
