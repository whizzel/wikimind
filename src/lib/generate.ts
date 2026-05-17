// lib/generate.ts
// Generate a structured Wikipedia-style article from HydraDB recall results
// Using Groq (free, fast) instead of Anthropic

import Groq from "groq-sdk";
import type { RecallResult } from "./hydra";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = "llama-3.3-70b-versatile"; // fast + smart, free tier generous

function buildContext(recall: RecallResult): string {
    const chunks = recall.chunks
        .map((c, i) => `[Source ${i + 1}]\n${c.content}`)
        .join("\n\n---\n\n");

    const relations = recall.graph_context.chunk_relations
        .flatMap((cr) => cr.relations)
        .slice(0, 50)
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
                    "You are WikiMind — an advanced AI that compiles highly structured, encyclopedic articles strictly grounded in retrieved knowledge. You write only in clean Markdown. No preamble, no conversational filler, just the requested article.",
            },
            {
                role: "user",
                content: `Write a comprehensive, highly-structured Wikipedia-style article about: **${topic}**

Use ONLY the following retrieved context. Do not hallucinate. If information is missing, simply omit it.

${context}

---

**Strict Format Requirements:**

1. **Infobox**: Start the article with a Markdown table acting as an Infobox. It should summarize the 4-6 most critical facts, dates, or primary entities at a glance.
2. **Opening**: A concise opening paragraph explaining what the topic is and why it matters.
3. **Sections**: Use \`##\` sections for major themes (e.g., History, Key Concepts, Methodology, Applications).
4. **Citations**: You MUST cite your claims using inline brackets pointing to the Source Chunks (e.g., \`[1]\`, \`[2]\`). Every factual claim must be cited.
5. **Knowledge Graph**: Create a \`## Knowledge Graph & Relationships\` section. Synthesize the provided Entity Graph into a readable, analytical summary of how the main entities connect.
6. **References**: End the article with a \`## References\` section listing the sources you cited (e.g., \`- [1] Source 1: <brief description of what chunk 1 contained>\`).
7. **Styling**: **Bold** the first use of key terms. Use bullet lists only for genuinely list-like content.
8. **Tone**: Encyclopedic, neutral, flat, and factual.

Output ONLY the raw markdown of the article.`,
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
                content: `You are WikiMind, a knowledgeable assistant with access to an entity graph and knowledge chunks about "${topic}". Answer concisely using ONLY the provided context. Be direct, factual, and strictly grounded.`,
            },
            {
                role: "user",
                content: `Question: ${question}

${context}

**Requirements:**
- Answer in 2-4 paragraphs max.
- You MUST cite the provided chunks using inline brackets (e.g., [1], [2]) when making factual claims.
- Do not hallucinate. If the context does not contain the answer, say so.`,
            },
        ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) throw new Error("No text in Groq response");
    return text;
}