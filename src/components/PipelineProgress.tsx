"use client";
// components/PipelineProgress.tsx
// Live SSE pipeline step tracker with animated states

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { motion } from "framer-motion";

export type PipelineStep =
    | "fetch"
    | "chunk"
    | "ingest"
    | "process"
    | "recall"
    | "generate"
    | "done"
    | "error";

export interface PipelineEvent {
    step: PipelineStep;
    message: string;
    data?: {
        chunkCount?: number;
        entityCount?: number;
        sourceIds?: string[];
        sources?: { id: string; title: string }[];
        article?: string;
        topic?: string;
    };
    error?: string;
}

const STEPS: { key: PipelineStep; label: string; icon: string }[] = [
    { key: "fetch", label: "Fetch", icon: "⬇" },
    { key: "chunk", label: "Chunk", icon: "✂" },
    { key: "ingest", label: "Ingest", icon: "⬆" },
    { key: "process", label: "Graph", icon: "◈" },
    { key: "recall", label: "Recall", icon: "⟳" },
    { key: "generate", label: "Generate", icon: "✦" },
];

type StepState = "pending" | "active" | "done" | "error";

interface Props {
    topic: string;
    sourceUrl?: string;
    userId?: string;
    onDone: (article: string, sourceIds: string[]) => void;
    onError?: (msg: string) => void;
}

export function PipelineProgress({ topic, sourceUrl, userId, onDone, onError }: Props) {
    const [events, setEvents] = useState<PipelineEvent[]>([]);
    const [stepStates, setStepStates] = useState<Record<string, StepState>>({});
    const [activeStep, setActiveStep] = useState<PipelineStep | null>(null);
    const [running, setRunning] = useState(false);
    const [started, setStarted] = useState(false);
    const logRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [events]);

    async function start() {
        setStarted(true);
        setRunning(true);
        setEvents([]);
        setStepStates({});
        setActiveStep(null);

        try {
            await fetchEventSource("/api/ingest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topic, sourceUrl, userId }),
                onopen: async (res) => {
                    if (res.ok && res.status === 200) {
                        return;
                    }
                    throw new Error(`HTTP ${res.status}`);
                },
                onmessage: (msg) => {
                    if (!msg.data) return;
                    try {
                        const event: PipelineEvent = JSON.parse(msg.data);
                        setEvents((prev) => [...prev, event]);

                        if (event.step === "done") {
                            setStepStates((prev) => {
                                const next = { ...prev };
                                STEPS.forEach((s) => { next[s.key] = "done"; });
                                return next;
                            });
                            setActiveStep(null);
                            setRunning(false);
                            if (event.data?.article && event.data?.sourceIds) {
                                onDone(event.data.article, event.data.sourceIds);
                            }
                        } else if (event.step === "error") {
                            setStepStates((prev) => ({ ...prev, [activeStep ?? ""]: "error" }));
                            setRunning(false);
                            onError?.(event.error ?? event.message);
                        } else {
                            setActiveStep(event.step);
                            setStepStates((prev) => {
                                const next = { ...prev };
                                const idx = STEPS.findIndex((s) => s.key === event.step);
                                STEPS.slice(0, idx).forEach((s) => { next[s.key] = "done"; });
                                next[event.step] = "active";
                                return next;
                            });
                        }
                    } catch {
                        // skip
                    }
                },
                onerror(err) {
                    throw err;
                }
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setRunning(false);
            onError?.(msg);
        }
    }

    if (!started) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-6">
                <div className="text-center space-y-2">
                    <p className="font-mono text-xs text-amber-500/60 uppercase tracking-widest">ready to build</p>
                    <p className="font-serif text-2xl text-slate-100">
                        Compile <span className="text-amber-400 italic">"{topic}"</span> into knowledge
                    </p>
                </div>
                <button
                    onClick={start}
                    className="group relative px-8 py-3 bg-amber-500 text-slate-950 font-mono text-sm font-bold uppercase tracking-widest hover:bg-amber-400 transition-all duration-200 hover:scale-105 active:scale-100"
                >
                    <span className="relative z-10">Run Pipeline</span>
                    <div className="absolute inset-0 bg-amber-300 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Step tracker */}
            <div className="grid grid-cols-6 gap-px bg-slate-800 border border-slate-700">
                {STEPS.map((step) => {
                    const state: StepState = stepStates[step.key] ?? "pending";
                    return (
                        <div
                            key={step.key}
                            className={cn(
                                "flex flex-col items-center gap-2 py-4 px-2 transition-all duration-500",
                                state === "pending" && "bg-slate-900 opacity-40",
                                state === "active" && "bg-slate-800",
                                state === "done" && "bg-slate-900",
                                state === "error" && "bg-red-950"
                            )}
                        >
                            <motion.div
                                animate={{
                                    scale: state === "active" ? 1.1 : 1,
                                    borderColor: state === "active" ? "#f59e0b" : state === "done" ? "#059669" : "#334155"
                                }}
                                className={cn(
                                    "w-8 h-8 flex items-center justify-center text-sm font-mono border transition-colors duration-300",
                                    state === "pending" && "border-slate-700 text-slate-600",
                                    state === "active" && "text-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.3)]",
                                    state === "done" && "text-emerald-400 bg-emerald-950/50",
                                    state === "error" && "border-red-500 text-red-400"
                                )}
                            >
                                {state === "done" ? "✓" : state === "error" ? "✗" : step.icon}
                            </motion.div>
                            <span
                                className={cn(
                                    "text-[10px] font-mono uppercase tracking-widest",
                                    state === "pending" && "text-slate-600",
                                    state === "active" && "text-amber-400",
                                    state === "done" && "text-emerald-500",
                                    state === "error" && "text-red-400"
                                )}
                            >
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Log */}
            <div
                ref={logRef}
                className="h-48 overflow-y-auto bg-slate-950 border border-slate-800 p-4 space-y-1 font-mono text-xs"
                style={{ scrollBehavior: "smooth" }}
            >
                {events.length === 0 && (
                    <span className="text-slate-600">Waiting for pipeline events...</span>
                )}
                {events.map((e, i) => (
                    <div key={i} className="flex gap-3 items-start">
                        <span className="text-slate-600 shrink-0 tabular-nums">
                            {String(i + 1).padStart(2, "0")}
                        </span>
                        <span
                            className={cn(
                                "shrink-0 w-16 uppercase tracking-wider",
                                e.step === "error" ? "text-red-400" : "text-amber-500/70"
                            )}
                        >
                            {e.step}
                        </span>
                        <span
                            className={cn(
                                "leading-relaxed",
                                e.step === "done" && "text-emerald-400",
                                e.step === "error" && "text-red-300",
                                e.step !== "done" && e.step !== "error" && "text-slate-300"
                            )}
                        >
                            {e.message}
                            {e.data?.chunkCount !== undefined && (
                                <span className="text-slate-500 ml-2">({e.data.chunkCount} chunks)</span>
                            )}
                            {e.data?.entityCount !== undefined && (
                                <span className="text-slate-500 ml-2">({e.data.entityCount} entities)</span>
                            )}
                        </span>
                    </div>
                ))}
                {running && (
                    <div className="flex gap-3 items-center text-amber-500/50">
                        <span className="text-slate-600">··</span>
                        <span className="animate-pulse">processing...</span>
                    </div>
                )}
            </div>
        </div>
    );
}