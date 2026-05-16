"use client";
// app/page.tsx
// WikiMind homepage — topic input, pipeline runner, recent topics

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PipelineProgress } from "@/components/PipelineProgress";
import { AnimatePresence, motion } from "framer-motion";

const EXAMPLE_TOPICS = [
  "Transformer architecture",
  "CRISPR gene editing",
  "Byzantine fault tolerance",
  "Dark matter",
  "Stoic philosophy",
  "Reinforcement learning",
];

export default function Home() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantReady, setTenantReady] = useState(false);
  const [recentTopics, setRecentTopics] = useState<string[]>([]);

  // Init tenant on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/tenant", { method: "POST" });
        const data = await res.json();
        if (data.status === "ready") setTenantReady(true);
      } catch {
        setTenantReady(true); // optimistic — let pipeline fail if needed
      }
    })();

    const stored = localStorage.getItem("wikimind-topics");
    if (stored) setRecentTopics(JSON.parse(stored));
  }, []);

  function saveTopic(t: string) {
    const updated = [t, ...recentTopics.filter((x) => x !== t)].slice(0, 8);
    setRecentTopics(updated);
    localStorage.setItem("wikimind-topics", JSON.stringify(updated));
  }

  function handleDone(article: string, sourceIds: string[]) {
    saveTopic(topic.trim());
    sessionStorage.setItem(
      `wikimind-article-${encodeURIComponent(topic.trim())}`,
      JSON.stringify({ article, sourceIds, timestamp: Date.now() })
    );
    router.push(`/wiki/${encodeURIComponent(topic.trim())}`);
  }

  function handleStart() {
    if (!topic.trim()) return;
    setError(null);
    setRunning(true);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px",
        }}
      />

      {/* Grid */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `linear-gradient(rgba(51,65,85,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(51,65,85,0.15) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 flex-1 max-w-3xl mx-auto px-6 py-16 md:py-24 w-full flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {!running ? (
            <motion.div
              key="hero"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40, filter: "blur(10px)" }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="w-full space-y-16"
            >
              {/* Header */}
              <div className="space-y-4 mt-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 border border-amber-500 flex items-center justify-center">
                    <span className="text-amber-400 text-sm font-mono">W</span>
                  </div>
                  <span className="font-mono text-xs uppercase tracking-widest text-slate-500">
                    WikiMind · Knowledge Compiler
                  </span>
                </div>

                <h1 className="font-serif text-5xl md:text-6xl leading-[1.1] text-slate-50">
                  Build your own
                  <br />
                  <span className="text-amber-400 italic">Wikipedia</span>
                </h1>

                <p className="text-slate-400 leading-relaxed max-w-lg font-light">
                  Enter any topic. WikiMind fetches real sources, ingests them into HydraDB's
                  context graph, and compiles a living knowledge article — one that compounds
                  with every question you ask.
                </p>

                <div className="flex items-center gap-4 font-mono text-xs text-slate-600">
                  <span className={tenantReady ? "text-emerald-500" : "text-amber-500 animate-pulse"}>
                    ● {tenantReady ? "Tenant ready" : "Initializing..."}
                  </span>
                  <span>HydraDB · Claude · WikiMind</span>
                </div>
              </div>

              {/* Input form */}
              <div className="space-y-4">
                <div className="relative">
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleStart()}
                    placeholder="e.g. Transformer architecture, Dark matter, CRISPR..."
                    className="w-full bg-slate-900/80 backdrop-blur-md border border-slate-700 px-5 py-4 font-serif text-lg text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60 transition-colors pr-36 shadow-xl"
                  />
                  <button
                    onClick={handleStart}
                    disabled={!topic.trim() || !tenantReady}
                    className="absolute right-2 top-2 bottom-2 px-5 bg-amber-500 text-slate-950 font-mono text-sm font-bold hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Compile →
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowUrl(!showUrl)}
                    className="font-mono text-xs text-slate-600 hover:text-amber-400 transition-colors"
                  >
                    {showUrl ? "▲ Hide URL" : "▼ Use custom URL"}
                  </button>
                </div>

                <AnimatePresence>
                  {showUrl && (
                    <motion.input
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      placeholder="https://... (optional — overrides Wikipedia)"
                      className="w-full bg-slate-900 border border-slate-700 px-5 py-3 font-mono text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40 transition-colors"
                    />
                  )}
                </AnimatePresence>

                {/* Example topics */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {EXAMPLE_TOPICS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTopic(t)}
                      className="px-3 py-1.5 border border-slate-800 font-mono text-xs text-slate-500 hover:border-amber-500/40 hover:text-amber-400 hover:bg-amber-500/5 transition-all"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent topics */}
              {recentTopics.length > 0 && (
                <div className="border-t border-slate-800 pt-8 space-y-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-slate-600">
                    Recent
                  </p>
                  <div className="space-y-1">
                    {recentTopics.map((t) => (
                      <div key={t} className="flex items-center gap-3 group">
                        <span className="text-slate-700 font-mono text-xs">→</span>
                        <button
                          onClick={() => router.push(`/wiki/${encodeURIComponent(t)}`)}
                          className="font-serif text-slate-400 hover:text-amber-400 transition-colors text-left"
                        >
                          {t}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* How it works */}
              <div className="mt-20 border-t border-slate-800 pt-10">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-600 mb-6">
                  How it works
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-slate-800">
                  {[
                    { n: "01", title: "Ingest", desc: "Fetches real sources and builds a HydraDB entity graph automatically" },
                    { n: "02", title: "Recall", desc: "Graph-first retrieval finds what's useful, not just what's similar" },
                    { n: "03", title: "Compound", desc: "Every answer files back into the graph — knowledge accumulates" },
                  ].map((step) => (
                    <div key={step.n} className="bg-slate-950 p-5 space-y-3">
                      <span className="font-mono text-xs text-amber-500/50">{step.n}</span>
                      <p className="font-serif text-slate-200">{step.title}</p>
                      <p className="font-mono text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="pipeline"
              initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              className="w-full flex-1 flex flex-col justify-center"
            >
              <div className="mb-12">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                      Running Compiler
                    </p>
                    <p className="font-serif text-3xl text-amber-400 mt-2 italic">{topic}</p>
                  </div>
                  <button
                    onClick={() => { setRunning(false); setError(null); }}
                    className="font-mono text-xs text-slate-600 hover:text-slate-300 transition-colors border border-slate-800 px-4 py-2 rounded hover:bg-slate-900"
                  >
                    ✕ Cancel
                  </button>
                </div>
                
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 px-4 py-3 border border-red-900 bg-red-950/30"
                  >
                    <p className="font-mono text-xs text-red-400">Error: {error}</p>
                  </motion.div>
                )}

                <PipelineProgress
                  topic={topic}
                  sourceUrl={sourceUrl || undefined}
                  userId="default-user"
                  onDone={handleDone}
                  onError={(msg) => {
                    setError(msg);
                    setRunning(false);
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}