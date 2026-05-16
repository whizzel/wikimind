// app/api/ingest/route.ts
// Streams pipeline progress as Server-Sent Events (SSE).
// The UI listens with EventSource and updates step-by-step.

import { NextRequest } from "next/server";
import { runPipeline, sseEvent } from "@/lib/pipeline";

export const runtime = "nodejs"; // SSE needs Node runtime, not Edge

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { topic, sourceUrl, userId } = body as {
        topic: string;
        sourceUrl?: string;
        userId?: string;
    };

    if (!topic?.trim()) {
        return new Response(JSON.stringify({ error: "topic is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    // Set up SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: string) => controller.enqueue(encoder.encode(data));

            try {
                await runPipeline(
                    { topic: topic.trim(), sourceUrl, userId },
                    (event) => send(sseEvent(event))
                );
            } catch {
                // Error already emitted inside runPipeline via onEvent
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no", // Disable Nginx buffering if deployed
        },
    });
}