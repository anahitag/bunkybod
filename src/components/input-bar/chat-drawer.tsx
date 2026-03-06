"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Bot, User, Sparkles, X, Mic, MicOff } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  intent?: string;
}

function formatReply(text: string) {
  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/);
  return (
    <div className="space-y-2">
      {paragraphs.map((p, pi) => {
        // Check if it's a list (lines starting with - or •)
        const lines = p.split("\n");
        const isList = lines.every((l) => /^\s*[-•*]\s/.test(l) || l.trim() === "");

        if (isList) {
          return (
            <ul key={pi} className="space-y-0.5">
              {lines.filter((l) => l.trim()).map((l, li) => (
                <li key={li} className="flex gap-1.5 text-sm">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  <span>{formatInline(l.replace(/^\s*[-•*]\s*/, ""))}</span>
                </li>
              ))}
            </ul>
          );
        }

        // Regular paragraph
        return <p key={pi} className="text-sm leading-relaxed">{formatInline(p.replace(/\n/g, " "))}</p>;
      })}
    </div>
  );
}

function formatInline(text: string) {
  // Bold **text** and numbers with units
  const parts = text.split(/(\*\*[^*]+\*\*|\b\d+[,.]?\d*\s*(?:cal|kcal|g|lbs|%|bpm|ms|min|hrs)\b)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (/^\d+[,.]?\d*\s*(?:cal|kcal|g|lbs|%|bpm|ms|min|hrs)$/.test(part)) {
      return <span key={i} className="font-semibold text-foreground">{part}</span>;
    }
    return part;
  });
}

export function ChatDrawer() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Listen for dashboard refresh events
  const triggerRefresh = useCallback(() => {
    window.dispatchEvent(new CustomEvent("bunkybod:refresh"));
  }, []);

  function toggleVoice() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Try Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
      setInput(transcript);

      // Auto-submit when final result
      if (event.results[event.results.length - 1].isFinal) {
        setIsListening(false);
        // Small delay to let state update, then submit
        setTimeout(() => {
          const form = document.querySelector("[data-chat-form]") as HTMLFormElement;
          form?.requestSubmit();
        }, 100);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setExpanded(true);
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const updatedMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setExpanded(true);

    try {
      const history = updatedMessages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationHistory: history }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message, intent: data.intent },
      ]);

      // Small delay to ensure DB writes are committed before dashboard fetches
      setTimeout(() => triggerRefresh(), 200);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const isExpanded = expanded && messages.length > 0;

  const inputBar = (
    <form onSubmit={handleSubmit} data-chat-form className="flex gap-2 p-2">
      <Button type="button" size="icon" variant={isListening ? "destructive" : "ghost"} className={`h-9 w-9 flex-shrink-0 ${isListening ? "animate-pulse" : ""}`} onClick={toggleVoice} disabled={loading}>
        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>
      <div className="relative flex-1">
        <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onFocus={() => messages.length > 0 && setExpanded(true)} placeholder={isListening ? "Listening..." : "Log food, ask questions, or chat..."} className="pl-9 h-9 text-[16px] sm:text-sm text-black dark:text-white font-medium placeholder:text-black/50 dark:placeholder:text-white/50 bg-white dark:bg-black/20" disabled={loading} />
      </div>
      <Button type="submit" size="icon" className="h-9 w-9 flex-shrink-0" disabled={loading || !input.trim()}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </form>
  );

  return (
    <>
      {/* Backdrop — covers entire screen, click anywhere to close */}
      {isExpanded && (
        <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setExpanded(false)} />
      )}

      {/* Chat drawer — fixed at bottom, responsive width */}
      <div
        className="fixed bottom-[52px] left-0 right-0 z-50"
        onClick={(e) => { if (isExpanded) e.stopPropagation(); }}
      >
        {/* Mobile: full width with small padding. Desktop: centered, max-w-2xl */}
        <div className="mx-auto px-2 sm:px-4 max-w-2xl">
          <Card className="shadow-lg border overflow-hidden relative bg-[#E8DEF8] dark:bg-[#3F2D6D]">
            {/* Close button */}
            {isExpanded && (
              <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-7 w-7 z-20 bg-background/80 backdrop-blur-sm rounded-full" onClick={() => setExpanded(false)}>
                <X className="h-4 w-4" />
              </Button>
            )}

            {/* Chat messages */}
            {isExpanded && (
              <div
                ref={scrollRef}
                className="overflow-y-auto p-3 pr-10 space-y-2"
                style={{ maxHeight: "min(40vh, 350px)" }}
              >
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}
                    <div className={`text-sm rounded-lg px-3 py-2 max-w-[80%] ${msg.role === "user" ? "bg-primary text-primary-foreground whitespace-pre-wrap" : "bg-muted"}`}>
                      {msg.role === "assistant" ? formatReply(msg.content) : msg.content}
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
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="h-3.5 w-3.5 text-primary" /></div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Thinking...</div>
                  </div>
                )}
              </div>
            )}

            {/* Input bar */}
            {inputBar}
          </Card>
        </div>
      </div>
    </>
  );
}
