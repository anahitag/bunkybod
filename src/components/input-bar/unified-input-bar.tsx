"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Bot, User, Sparkles } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  intent?: string;
}

interface UnifiedInputBarProps {
  onDataChanged: () => void;
}

export function UnifiedInputBar({ onDataChanged }: UnifiedInputBarProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    const updatedMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      // Send conversation history for context
      const history = updatedMessages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationHistory: history }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        // Vercel returned non-JSON (e.g., 504 HTML timeout page)
        throw new Error(
          res.status === 504
            ? "Request timed out. The server took too long to respond."
            : `Server error (${res.status}). Please try again.`
        );
      }

      if (!res.ok) {
        throw new Error(data.message || `Server error (${res.status})`);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message, intent: data.intent },
      ]);

      // Always refresh dashboard after any AI interaction — covers food logs,
      // deletes, goal changes, profile updates, and multi-action responses
      onDataChanged();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: errorMsg },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <Card>
      <CardContent className="p-3">
        {/* Chat History */}
        {messages.length > 0 && (
          <div className="max-h-[250px] overflow-y-auto mb-3" ref={scrollRef}>
            <div className="space-y-2">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div
                    className={`text-sm rounded-lg px-3 py-2 max-w-[85%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.content}
                    {msg.intent && msg.intent !== "general_chat" && msg.intent !== "error" && (
                      <span className="block text-xs opacity-60 mt-0.5 capitalize">
                        {msg.intent.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-2 items-center">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Try: "I had 2 eggs for breakfast" or "How much protein today?"'
              className="pl-9"
              disabled={loading}
            />
          </div>
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
