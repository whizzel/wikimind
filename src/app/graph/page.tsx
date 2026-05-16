"use client";
// app/graph/page.tsx
// Global knowledge graph explorer — shows all ingested entities across all topics

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraphView, GraphRelation } from "@/components/GraphView";

interface KnowledgeSource {
    id: string;
    title: string;
    type: string;
    timestamp: string;
}

export default function GraphPage() {
    const router = useRouter();
    const [sources, setSources] = useState<KnowledgeSource[]>([]);
    const [selectedSource, setSelectedSource] = useState<KnowledgeSource | null>(null);
    const [relations, setRelations] = useState<GraphRelation[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingSources, setLoadingSources] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load all ingested knowledge sources
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/recall", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ topic: " ", mode: "context", userId: "default-user" }),
                });
                const data = await res.json();
                setSources(data.sources ?? []);
                // Auto-load graph for first source
                if (data.sources?.length > 0) {
                    const rels = extractRelations(data.graph_context);
                    setRelations(rels);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                setLoadingSources(false);
            }
        })();
    }, []);

    function extractRelations(graphContext: {
        chunk_relations?: { relations: GraphRelation[] }[];
    }): GraphRelation[] {
        if (!graphContext?.chunk_relations) return [];
        return graphContext.chunk_relations
            .flatMap((cr) => cr.relations)
            .filter(
                (r, i, arr) =>
                    r.entity &&
                    r.target &&
                    arr.findIndex((x) => x.entity === r.entity && x.target === r.target) === i
            );
    }

    async function loadSourceGraph(source: KnowledgeSource) {
        setSelectedSource(source);
        setLoading(true);
        setRelations([]);
        try {
            const res = await fetch("/api/recall", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    topic: source.title || source.id,
                    mode: "context",
                    userId: "default-user",
                }),
            });
            const data = await res.json();
            setRelations(extractRelations(data.graph_context));
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }

    const activeTopic = selectedSource?.title || "Knowledge Graph";

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            {/* Nav */}
            <nav className="border-b border-slate-800 px-6 py-3 flex items-center gap-4">
                <button
                    onClick={() => router.push("/")}
                    className="font-mono text-xs text-slate-500 hover:text-amber-400 transition-colors"
                >
                    ← WikiMind
                </button>
                <span className="text-slate-700">|</span>
                <span className="font-mono text-xs uppercase tracking-widest text-slate-500">
                    Graph Explorer
                </span>
            </nav>

            <div className="flex h-[calc(100vh-49px)]">
                {/* Sidebar — sources list */}
                <aside className="w-64 shrink-0 border-r border-slate-800 flex flex-col">
                    <div className="px-4 py-4 border-b border-slate-800">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                            Ingested Sources
                        </p>
                        <p className="font-mono text-xs text-slate-600 mt-1">
                            {sources.length} source{sources.length !== 1 ? "s" : ""}
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {loadingSources && (
                            <div className="px-4 py-6 space-y-2">
                                {[...Array(4)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-8 bg-slate-800 animate-pulse"
                                        style={{ opacity: 1 - i * 0.2 }}
                                    />
                                ))}
                            </div>
                        )}

                        {!loadingSources && sources.length === 0 && (
                            <div className="px-4 py-6 space-y-3">
                                <p className="font-mono text-xs text-slate-600">
                                    No sources yet.
                                </p>
                                <button
                                    onClick={() => router.push("/")}
                                    className="w-full px-3 py-2 border border-slate-700 font-mono text-xs text-slate-400 hover:border-amber-500/50 hover:text-amber-400 transition-all text-left"
                                >
                                    + Compile a topic
                                </button>
                            </div>
                        )}

                        {sources.map((source) => (
                            <button
                                key={source.id}
                                onClick={() => loadSourceGraph(source)}
                                className={`w-full text-left px-4 py-3 border-b border-slate-800/50 transition-all group ${selectedSource?.id === source.id
                                        ? "bg-amber-500/10 border-l-2 border-l-amber-500"
                                        : "hover:bg-slate-900 border-l-2 border-l-transparent"
                                    }`}
                            >
                                <p
                                    className={`font-mono text-xs truncate transition-colors ${selectedSource?.id === source.id
                                            ? "text-amber-400"
                                            : "text-slate-400 group-hover:text-slate-200"
                                        }`}
                                >
                                    {source.title || source.id}
                                </p>
                                <p className="font-mono text-[9px] text-slate-600 mt-0.5">
                                    {source.type || "knowledge"} ·{" "}
                                    {source.timestamp
                                        ? new Date(source.timestamp).toLocaleDateString()
                                        : "—"}
                                </p>
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Main — graph */}
                <main className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-500/60">
                                Entity Relationship Graph
                            </p>
                            <h1 className="font-serif text-2xl text-slate-100 mt-1">
                                {activeTopic}
                            </h1>
                            {relations.length > 0 && (
                                <p className="font-mono text-xs text-slate-500 mt-1">
                                    {relations.length} relationships extracted by HydraDB
                                </p>
                            )}
                        </div>

                        {selectedSource && (
                            <button
                                onClick={() =>
                                    router.push(
                                        `/wiki/${encodeURIComponent(selectedSource.title || selectedSource.id)}`
                                    )
                                }
                                className="px-4 py-2 border border-slate-700 font-mono text-xs text-slate-400 hover:border-amber-500 hover:text-amber-400 transition-all shrink-0"
                            >
                                View Article →
                            </button>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="px-4 py-3 border border-red-900 bg-red-950/30">
                            <p className="font-mono text-xs text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div className="flex items-center gap-3 py-12">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className="w-2 h-2 bg-amber-500 rounded-full animate-bounce"
                                    style={{ animationDelay: `${i * 150}ms` }}
                                />
                            ))}
                            <span className="font-mono text-xs text-slate-500">
                                Loading graph relations...
                            </span>
                        </div>
                    )}

                    {/* Graph */}
                    {!loading && relations.length > 0 && (
                        <GraphView
                            relations={relations}
                            topic={activeTopic}
                            className="w-full"
                        />
                    )}

                    {/* Empty state */}
                    {!loading && !loadingSources && relations.length === 0 && !error && (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="w-16 h-16 border border-slate-700 flex items-center justify-center">
                                <span className="text-2xl text-slate-600">◈</span>
                            </div>
                            <div className="text-center space-y-2">
                                <p className="font-mono text-xs text-slate-500">
                                    {sources.length > 0
                                        ? "Select a source from the left to explore its graph"
                                        : "No knowledge ingested yet"}
                                </p>
                                {sources.length === 0 && (
                                    <button
                                        onClick={() => router.push("/")}
                                        className="px-4 py-2 border border-slate-700 font-mono text-xs text-slate-400 hover:border-amber-500 hover:text-amber-400 transition-all"
                                    >
                                        ← Compile your first topic
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Legend */}
                    {relations.length > 0 && (
                        <div className="flex flex-wrap gap-6 pt-4 border-t border-slate-800">
                            {[
                                { color: "bg-amber-400", label: "Topic node" },
                                { color: "bg-indigo-500", label: "Selected entity" },
                                { color: "bg-slate-500", label: "Entity" },
                            ].map((item) => (
                                <div key={item.label} className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                                    <span className="font-mono text-[10px] text-slate-500">
                                        {item.label}
                                    </span>
                                </div>
                            ))}
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-px bg-amber-500/50" />
                                <span className="font-mono text-[10px] text-slate-500">
                                    Relationship (hover to label)
                                </span>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}