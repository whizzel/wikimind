"use client";
// components/ChatSidebar.tsx
// Q&A chat panel — each question recalls from HydraDB and answers with Groq

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Message {
    role: "user" | "assistant";
    content: string;
    sources?: { id: string; title: string }[];
    loading?: boolean;
}

interface Props {
    topic: string;
    userId?: string;
    className?: string;
}

function getSuggested(topic: string) {
    return [
        `What are the key concepts of ${topic}?`,
        `Who are the main entities involved in ${topic}?`,
        `What are the most important relationships in ${topic}?`,
        `Summarize ${topic} in 3 bullet points`,
    ];
}

export function ChatSidebar({ topic, userId, className }: Props) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    async function ask(question: string) {
        if (!question.trim() || loading) return;

        const userMsg: Message = { role: "user", content: question };
        const loadingMsg: Message = { role: "assistant", content: "", loading: true };
        setMessages((prev) => [...prev, userMsg, loadingMsg]);
        setInput("");
        setLoading(true);

        try {
            const res = await fetch("/api/recall", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topic, question, userId, mode: "qa" }),
            });

            const data = await res.json();

            setMessages((prev) => [
                ...prev.slice(0, -1), // remove loading
                {
                    role: "assistant",
                    content: data.error
                        ? `Error: ${data.error}`
                        : data.answer,
                    sources: data.sources?.slice(0, 3),
                },
            ]);
        } catch (err) {
            setMessages((prev) => [
                ...prev.slice(0, -1),
                {
                    role: "assistant",
                    content: `Network error: ${err instanceof Error ? err.message : String(err)}`,
                },
            ]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    }

    function handleKey(e: React.KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            ask(input);
        }
    }

    return (
        <div className={cn("flex flex-col h-full bg-slate-950 border-l border-slate-800", className)}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-800 shrink-0">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                    Knowledge Chat
                </p>
                <p className="font-serif text-sm text-slate-300 mt-0.5 truncate">
                    {topic}
                </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
                {messages.length === 0 && (
                    <div className="space-y-4">
                        <p className="font-mono text-xs text-slate-600 text-center">
                            Ask anything about this topic
                        </p>
                        <div className="space-y-2">
                            {getSuggested(topic).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => ask(s)}
                                    className="w-full text-left px-3 py-2 border border-slate-800 font-mono text-xs text-slate-400 hover:border-amber-500/50 hover:text-amber-400 hover:bg-amber-500/5 transition-all duration-200"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={cn(
                            "space-y-1",
                            msg.role === "user" && "flex flex-col items-end"
                        )}
                    >
                        {msg.role === "user" ? (
                            <div className="max-w-[85%] bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                                <p className="font-mono text-xs text-amber-300 leading-relaxed">
                                    {msg.content}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-1 h-1 bg-amber-500 rounded-full" />
                                    <span className="font-mono text-[10px] text-amber-500/60 uppercase tracking-widest">
                                        WikiMind
                                    </span>
                                </div>
                                {msg.loading ? (
                                    <div className="flex gap-1 py-2">
                                        {[0, 1, 2].map((i) => (
                                            <div
                                                key={i}
                                                className="w-1.5 h-1.5 bg-amber-500/40 rounded-full animate-bounce"
                                                style={{ animationDelay: `${i * 150}ms` }}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                        {msg.content}
                                    </div>
                                )}
                                {msg.sources && msg.sources.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {msg.sources.map((s) => (
                                            <span
                                                key={s.id}
                                                className="px-1.5 py-0.5 bg-slate-800 font-mono text-[9px] text-slate-500 border border-slate-700 truncate max-w-[120px]"
                                                title={s.title}
                                            >
                                                {s.title || s.id}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-slate-800 shrink-0">
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKey}
                        placeholder="Ask anything..."
                        disabled={loading}
                        className="flex-1 bg-slate-900 border border-slate-700 px-3 py-2 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 disabled:opacity-50 transition-colors"
                    />
                    <button
                        onClick={() => ask(input)}
                        disabled={loading || !input.trim()}
                        className="px-3 py-2 bg-amber-500 text-slate-950 font-mono text-xs font-bold hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        →
                    </button>
                </div>
                <p className="font-mono text-[9px] text-slate-700 mt-1.5">
                    Powered by HydraDB recall + Groq
                </p>
            </div>
        </div>
    );
}