// lib/generate.ts
// Generate a structured Wikipedia-style article from HydraDB recall results
// Using Groq (free, fast) instead of Anthropic

import Groq from "groq-sdk";
import type { RecallResult } from "./hydra";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = "llama-3.3-70b-versatile"; // fast + smart, free tier generous

function buildContext(recall: RecallResult): string {
    const chunks = recall.chunks
        .map((c, i) => `[Chunk ${i + 1}]\n${c.content}`)
        .join("\n\n---\n\n");

    const relations = recall.graph_context.chunk_relations
        .flatMap((cr) => cr.relations)
        .slice(0, 30)
        .map((r) => `${r.entity} → ${r.relation} → ${r.target}`)
        .join("\n");

    return `## Source Chunks\n${chunks}\n\n## Entity Graph\n${relations}`;
}

export async function generateArticle(
    topic: string,
    recall: RecallResult
): Promise<string> {
    const context = buildContext(recall);

    const completion = await groq.chat.completions.create({
        model: MODEL,
        max_tokens: 4096,
        temperature: 0.3,
        messages: [
            {
                role: "system",
                content:
                    "You are WikiMind — an AI that writes structured, encyclopedic articles grounded in retrieved knowledge. You write only in clean Markdown. No preamble, no commentary, just the article.",
            },
            {
                role: "user",
                content: `Write a comprehensive Wikipedia-style article about: **${topic}**

Use ONLY the following retrieved context. Do not hallucinate. If information is missing, say so.

${context}

---

Format requirements:
- A concise opening paragraph (what it is, why it matters)
- ## sections for major themes (e.g. History, Key Concepts, Applications, Notable Entities)
- **Bold** for first use of key terms
- Bullet lists only for genuinely list-like content
- A ## Key Entities section at the end listing main entities and their graph relationships
- Tone: encyclopedic, flat, factual — no filler words

Output only the article markdown, nothing else.`,
            },
        ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) throw new Error("No text in Groq response");
    return text;
}

export async function answerQuestion(
    topic: string,
    question: string,
    recall: RecallResult
): Promise<string> {
    const context = buildContext(recall);

    const completion = await groq.chat.completions.create({
        model: MODEL,
        max_tokens: 1024,
        temperature: 0.2,
        messages: [
            {
                role: "system",
                content: `You are WikiMind, a knowledgeable assistant with access to a knowledge graph about "${topic}". Answer concisely using only the provided context. Be direct and factual.`,
            },
            {
                role: "user",
                content: `Question: ${question}

${context}

Answer in 2-4 paragraphs max. Cite chunks by number when relevant (e.g. [Chunk 3]).`,
            },
        ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) throw new Error("No text in Groq response");
    return text;
}