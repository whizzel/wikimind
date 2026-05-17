// lib/pipeline.ts
// WikiMind ingest pipeline — fetch content → chunk → ingest → generate article
// Emits Server-Sent Events so the UI can show live progress.

import { ingestText, waitForProcessing, recall, addMemory, TENANT_ID } from "./hydra";
import { generateArticle } from "./generate";
import { saveArticle } from "./storage";

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
    data?: unknown;
    error?: string;
}

/** SSE helper — formats an event for the ReadableStream */
export function sseEvent(event: PipelineEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/** Scrape a URL and return plain text */
async function fetchUrl(url: string): Promise<string> {
    const res = await fetch(
        `https://r.jina.ai/${url}`, // Jina Reader — free URL → markdown
        { headers: { Accept: "text/plain" } }
    );
    if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);
    return res.text();
}

/** Use Wikipedia API for topic-based lookups */
async function fetchWikipedia(topic: string): Promise<string> {
    const encoded = encodeURIComponent(topic.replace(/ /g, "_"));
    const headers = { 
        Accept: "application/json",
        "User-Agent": "WikiMind/1.0 (https://github.com/whizzel/wikimind)"
    };

    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    const res = await fetch(url, { headers });
    
    if (!res.ok) {
        if (res.status === 404) throw new Error(`Wikipedia article not found for: "${topic}". Try a different topic or use a custom URL.`);
        throw new Error(`Wikipedia API Error (${res.status}): Failed to fetch summary.`);
    }
    const data = await res.json();

    // Also fetch the full extract
    const fullUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=extracts&explaintext=true&format=json&origin=*`;
    const fullRes = await fetch(fullUrl, { headers });
    
    if (!fullRes.ok) {
         throw new Error(`Wikipedia API Error (${fullRes.status}): Failed to fetch full article text.`);
    }

    const fullData = await fullRes.json();
    const pages = fullData.query.pages;
    const page = pages[Object.keys(pages)[0]];
    const fullText = page?.extract ?? data.extract;

    return `# ${data.title}\n\n${fullText}`;
}

// ─── Chunk ────────────────────────────────────────────────────────────────────

/** Split text into ~800 token chunks with 100 token overlap */
function chunkText(text: string, chunkSize = 3200, overlap = 400): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start += chunkSize - overlap;
    }
    return chunks;
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

export interface PipelineInput {
    topic: string;
    sourceUrl?: string;   // optional — if provided, scrape it; otherwise use Wikipedia
    userId?: string;      // for memory personalization
}

export interface PipelineOutput {
    article: string;       // markdown article
    sourceIds: string[];   // HydraDB source IDs ingested
    topic: string;
}

/**
 * Run the full ingest → recall → generate pipeline.
 * Calls onEvent for each step so the caller can stream SSE to the client.
 */
export async function runPipeline(
    input: PipelineInput,
    onEvent: (event: PipelineEvent) => void
): Promise<PipelineOutput> {
    const { topic, sourceUrl, userId } = input;
    const tenantId = TENANT_ID;

    try {
        // ── Step 1: Fetch ──────────────────────────────────────────────────────
        onEvent({ step: "fetch", message: `Fetching content for "${topic}"...` });

        let rawText: string;
        if (sourceUrl) {
            rawText = await fetchUrl(sourceUrl);
            onEvent({ step: "fetch", message: `Scraped ${sourceUrl}` });
        } else {
            rawText = await fetchWikipedia(topic);
            onEvent({ step: "fetch", message: `Fetched Wikipedia: ${topic}` });
        }

        // Truncate very long articles to keep ingestion fast
        const truncated = rawText.slice(0, 40_000);

        // ── Step 2: Chunk ──────────────────────────────────────────────────────
        onEvent({ step: "chunk", message: "Chunking content..." });
        const chunks = chunkText(truncated);
        onEvent({
            step: "chunk",
            message: `Split into ${chunks.length} chunk${chunks.length !== 1 ? "s" : ""}`,
            data: { chunkCount: chunks.length },
        });

        // ── Step 3: Ingest ─────────────────────────────────────────────────────
        onEvent({ step: "ingest", message: "Ingesting into HydraDB Knowledge..." });

        // Combine chunks back into one document — HydraDB handles chunking internally
        const ingestResult = await ingestText(tenantId, topic, truncated);

        if (!ingestResult.success || ingestResult.failed_count > 0) {
            throw new Error("HydraDB ingestion failed");
        }

        const sourceIds = ingestResult.results.map((r) => r.source_id);
        onEvent({
            step: "ingest",
            message: `Ingested — source ID: ${sourceIds[0]}`,
            data: { sourceIds },
        });

        // ── Step 4: Wait for processing ────────────────────────────────────────
        onEvent({ step: "process", message: "HydraDB building entity graph..." });
        await waitForProcessing(tenantId, sourceIds[0]);
        onEvent({ step: "process", message: "Graph ready ✓" });

        // ── Step 5: Recall ─────────────────────────────────────────────────────
        onEvent({ step: "recall", message: `Recalling context for "${topic}"...` });
        const recallResult = await recall(tenantId, topic, {
            userId,
            maxResults: 15,
            mode: "thinking",
            graphContext: true,
        });

        const entityCount = recallResult.graph_context.chunk_relations.reduce(
            (acc, cr) => acc + cr.relations.length,
            0
        );
        onEvent({
            step: "recall",
            message: `Retrieved ${recallResult.chunks.length} chunks, ${entityCount} graph relations`,
            data: {
                chunkCount: recallResult.chunks.length,
                entityCount,
                sources: recallResult.sources,
            },
        });

        // Store what the user searched for as a memory
        if (userId) {
            await addMemory(tenantId, userId, `User searched for: ${topic}`).catch(() => { });
        }

        // ── Step 6: Generate ───────────────────────────────────────────────────
        onEvent({ step: "generate", message: "Generating article with Groq..." });
        const article = await generateArticle(topic, recallResult);
        onEvent({ step: "generate", message: "Article generated ✓" });

        // File the generated article BACK into HydraDB so answers compound
        const articleIngest = await ingestText(
            tenantId,
            `${topic}-wikimind-article`,
            article
        );
        if (articleIngest.success) {
            sourceIds.push(...articleIngest.results.map((r) => r.source_id));
        }

        // ── Done ───────────────────────────────────────────────────────────────
        await saveArticle(topic, article, sourceIds);

        onEvent({
            step: "done",
            message: "Pipeline complete",
            data: { article, sourceIds, topic },
        });

        return { article, sourceIds, topic };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        onEvent({ step: "error", message, error: message });
        throw err;
    }
}