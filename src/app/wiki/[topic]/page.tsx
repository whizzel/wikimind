"use client";
// app/wiki/[topic]/page.tsx
// Full 3-panel wiki page: article + chat sidebar + graph tab

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArticleView } from "@/components/ArticleView";
import { ChatSidebar } from "@/components/ChatSidebar";
import { GraphView, GraphRelation } from "@/components/GraphView";
import { cn } from "@/lib/utils";

type Tab = "article" | "graph";

interface StoredData {
    article: string;
    sourceIds: string[];
    timestamp: number;
}

export default function WikiPage() {
    const params = useParams();
    const router = useRouter();
    const topic = decodeURIComponent(params.topic as string);

    const [data, setData] = useState<StoredData | null>(null);
    const [tab, setTab] = useState<Tab>("article");
    const [graphRelations, setGraphRelations] = useState<GraphRelation[]>([]);
    const [loadingGraph, setLoadingGraph] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [sources, setSources] = useState<{ id: string; title: string }[]>([]);

    // Load article from API or fallback to sessionStorage
    useEffect(() => {
        async function fetchArticle() {
            try {
                const res = await fetch(`/api/article?topic=${encodeURIComponent(topic)}`);
                if (res.ok) {
                    const fetchedData = await res.json();
                    setData(fetchedData);
                } else {
                    const key = `wikimind-article-${encodeURIComponent(topic)}`;
                    const stored = sessionStorage.getItem(key);
                    if (stored) setData(JSON.parse(stored));
                }
            } catch (e) {
                console.error("Failed to fetch article", e);
            }
        }
        fetchArticle();
    }, [topic]);

    // Load graph when graph tab selected
    useEffect(() => {
        if (tab === "graph" && graphRelations.length === 0) {
            loadGraph();
        }
    }, [tab]);

    async function loadGraph() {
        setLoadingGraph(true);
        try {
            const res = await fetch("/api/recall", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topic, mode: "context", userId: "default-user" }),
            });
            const d = await res.json();
            setSources(d.sources ?? []);

            const relations: GraphRelation[] = (d.graph_context?.chunk_relations ?? [])
                .flatMap((cr: { relations: GraphRelation[] }) => cr.relations)
                .filter(
                    (r: GraphRelation, i: number, arr: GraphRelation[]) =>
                        arr.findIndex((x) => x.entity === r.entity && x.target === r.target) === i
                );
            setGraphRelations(relations);
        } catch {
            // silently fail
        } finally {
            setLoadingGraph(false);
        }
    }

    async function regenerate() {
        setRegenerating(true);
        try {
            const res = await fetch("/api/recall", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topic, mode: "article", userId: "default-user" }),
            });
            const d = await res.json();
            if (d.article) {
                const updated = { article: d.article, sourceIds: data?.sourceIds ?? [], timestamp: Date.now() };
                setData(updated);
                sessionStorage.setItem(`wikimind-article-${encodeURIComponent(topic)}`, JSON.stringify(updated));
                setSources(d.sources ?? []);
            }
        } finally {
            setRegenerating(false);
        }
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <p className="font-mono text-xs text-slate-600">No article found for "{topic}"</p>
                    <button
                        onClick={() => router.push("/")}
                        className="px-4 py-2 border border-slate-700 font-mono text-xs text-slate-400 hover:border-amber-500 hover:text-amber-400 transition-all"
                    >
                        ← Go compile it
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-slate-950 text-slate-100 flex flex-col">
            {/* Top nav */}
            <nav className="border-b border-slate-800 px-6 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push("/")}
                        className="font-mono text-xs text-slate-500 hover:text-amber-400 transition-colors"
                    >
                        ← WikiMind
                    </button>
                    <span className="text-slate-700">|</span>
                    <span className="font-serif text-slate-300 truncate max-w-[300px]">{topic}</span>
                </div>

                {/* Tabs */}
                <div className="flex gap-1">
                    {(["article", "graph"] as Tab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={cn(
                                "px-4 py-1.5 font-mono text-xs uppercase tracking-widest transition-all",
                                tab === t
                                    ? "bg-amber-500 text-slate-950 font-bold"
                                    : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </nav>

            {/* Main content */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Left: Article or Graph */}
                <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10 min-w-0">
                    {tab === "article" && (
                        <ArticleView
                            topic={topic}
                            article={data.article}
                            sources={sources}
                            onRegenerate={regenerate}
                            regenerating={regenerating}
                        />
                    )}

                    {tab === "graph" && (
                        <div className="space-y-6">
                            <div>
                                <p className="font-mono text-[10px] uppercase tracking-widest text-amber-500/60 mb-1">
                                    Entity Graph
                                </p>
                                <h2 className="font-serif text-2xl text-slate-100">{topic}</h2>
                                <p className="font-mono text-xs text-slate-500 mt-1">
                                    HydraDB context graph — entities and relationships extracted at ingest time
                                </p>
                            </div>

                            {loadingGraph ? (
                                <div className="flex items-center gap-3 py-8">
                                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" />
                                    <p className="font-mono text-xs text-slate-500">Loading graph...</p>
                                </div>
                            ) : (
                                <GraphView relations={graphRelations} topic={topic} />
                            )}
                        </div>
                    )}
                </div>

                {/* Right: Chat sidebar */}
                <div className="hidden lg:flex w-80 xl:w-96 shrink-0">
                    <ChatSidebar
                        topic={topic}
                        userId="default-user"
                        className="flex-1"
                    />
                </div>
            </div>

            {/* Mobile chat toggle */}
            <div className="lg:hidden border-t border-slate-800 px-4 py-3 shrink-0">
                <p className="font-mono text-xs text-slate-600 text-center">
                    Chat available on desktop
                </p>
            </div>
        </div>
    );
}