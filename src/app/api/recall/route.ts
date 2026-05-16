// app/api/recall/route.ts
// Two modes:
//   POST { topic, question, userId }  → answer a question via HydraDB recall + Claude
//   POST { topic, userId }            → recall context for a topic (no question)

import { NextRequest, NextResponse } from "next/server";
import { recall, recallMemories, addMemory, TENANT_ID } from "@/lib/hydra";
import { answerQuestion, generateArticle } from "@/lib/generate";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { topic, question, userId, mode = "qa" } = body as {
            topic: string;
            question?: string;
            userId?: string;
            mode?: "qa" | "article" | "context";
        };

        if (!topic?.trim()) {
            return NextResponse.json({ error: "topic is required" }, { status: 400 });
        }

        const tenantId = TENANT_ID;

        // Always recall knowledge about the topic
        const knowledgeRecall = await recall(tenantId, topic, {
            userId,
            maxResults: 15,
            mode: "thinking",
            graphContext: true,
        });

        // Also recall user memories if userId provided
        let memoryContext = "";
        if (userId) {
            try {
                const memRecall = await recallMemories(tenantId, userId, topic);
                if (memRecall.chunks.length > 0) {
                    memoryContext = memRecall.chunks.map((c) => c.content).join("\n");
                }
            } catch {
                // Memories are optional — don't fail the whole request
            }
        }

        // mode: "context" — just return raw recall results (for graph view etc.)
        if (mode === "context") {
            return NextResponse.json({
                chunks: knowledgeRecall.chunks,
                sources: knowledgeRecall.sources,
                graph_context: knowledgeRecall.graph_context,
                memory_context: memoryContext,
            });
        }

        // mode: "article" — regenerate the article from current recall
        if (mode === "article") {
            const article = await generateArticle(topic, knowledgeRecall);
            return NextResponse.json({ article, sources: knowledgeRecall.sources });
        }

        // mode: "qa" (default) — answer a specific question
        if (!question?.trim()) {
            return NextResponse.json({ error: "question is required for qa mode" }, { status: 400 });
        }

        const answer = await answerQuestion(topic, question, knowledgeRecall);

        // Store this Q&A interaction as a memory
        if (userId) {
            await addMemory(
                tenantId,
                userId,
                `User asked about "${topic}": ${question}\nAnswer: ${answer}`
            ).catch(() => { });
        }

        return NextResponse.json({
            answer,
            sources: knowledgeRecall.sources,
            graph_context: knowledgeRecall.graph_context,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[recall] error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}