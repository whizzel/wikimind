"use client";
// components/ArticleView.tsx
// Renders a markdown article in Wikipedia-style with a floating TOC

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Heading {
    id: string;
    level: number;
    text: string;
}

interface Props {
    topic: string;
    article: string;
    sources?: { id: string; title: string; url?: string }[];
    onRegenerate?: () => void;
    regenerating?: boolean;
}

// Minimal markdown → HTML (no external dep needed for hackathon)
function renderMarkdown(md: string): string {
    return md
        // H2
        .replace(/^## (.+)$/gm, (_, t) => {
            const id = t.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            return `<h2 id="${id}" class="wiki-h2">${t}</h2>`;
        })
        // H3
        .replace(/^### (.+)$/gm, (_, t) => {
            const id = t.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            return `<h3 id="${id}" class="wiki-h3">${t}</h3>`;
        })
        // Bold
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        // Italic
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        // Inline code
        .replace(/`(.+?)`/g, '<code class="wiki-code">$1</code>')
        // Bullet lists
        .replace(/^- (.+)$/gm, "<li>$1</li>")
        .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul class="wiki-ul">${m}</ul>`)
        // Paragraphs (blank line separated)
        .replace(/\n\n([^<\n][^\n]*)/g, "\n\n<p>$1</p>")
        // Leading paragraph
        .replace(/^([^<\n#][^\n]+)/, "<p>$1</p>");
}

function extractHeadings(md: string): Heading[] {
    const headings: Heading[] = [];
    const lines = md.split("\n");
    for (const line of lines) {
        const h2 = line.match(/^## (.+)$/);
        const h3 = line.match(/^### (.+)$/);
        if (h2) {
            headings.push({
                id: h2[1].toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                level: 2,
                text: h2[1],
            });
        } else if (h3) {
            headings.push({
                id: h3[1].toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                level: 3,
                text: h3[1],
            });
        }
    }
    return headings;
}

export function ArticleView({ topic, article, sources = [], onRegenerate, regenerating }: Props) {
    const [activeId, setActiveId] = useState<string>("");
    const contentRef = useRef<HTMLDivElement>(null);

    const headings = useMemo(() => extractHeadings(article), [article]);
    const html = useMemo(() => renderMarkdown(article), [article]);

    // Intersection observer for TOC highlighting
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id);
                    }
                }
            },
            { rootMargin: "-20% 0px -70% 0px" }
        );

        const headingEls = contentRef.current?.querySelectorAll("h2, h3") ?? [];
        headingEls.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [html]);

    function scrollTo(id: string) {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    return (
        <div className="flex gap-8 relative">
            {/* TOC sidebar */}
            {headings.length > 0 && (
                <aside className="hidden xl:block w-52 shrink-0">
                    <div className="sticky top-6 space-y-1">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
                            Contents
                        </p>
                        {headings.map((h) => (
                            <button
                                key={h.id}
                                onClick={() => scrollTo(h.id)}
                                className={cn(
                                    "block w-full text-left font-mono text-xs leading-relaxed transition-all duration-200 hover:text-amber-400",
                                    h.level === 2 && "pl-0",
                                    h.level === 3 && "pl-3",
                                    activeId === h.id
                                        ? "text-amber-400 border-l-2 border-amber-400 pl-2"
                                        : "text-slate-500 border-l-2 border-transparent pl-2"
                                )}
                            >
                                {h.text}
                            </button>
                        ))}
                    </div>
                </aside>
            )}

            {/* Article */}
            <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="border-b border-slate-700 pb-6 mb-8">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-500/60 mb-2">
                                WikiMind Article
                            </p>
                            <h1 className="font-serif text-3xl md:text-4xl text-slate-50 leading-tight">
                                {topic}
                            </h1>
                        </div>
                        {onRegenerate && (
                            <button
                                onClick={onRegenerate}
                                disabled={regenerating}
                                className="shrink-0 px-4 py-2 border border-slate-700 font-mono text-xs text-slate-400 hover:border-amber-500 hover:text-amber-400 transition-all duration-200 disabled:opacity-40"
                            >
                                {regenerating ? "Regenerating..." : "⟳ Regenerate"}
                            </button>
                        )}
                    </div>

                    {sources.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {sources.slice(0, 5).map((s) => (
                                <span
                                    key={s.id}
                                    className="px-2 py-0.5 bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-400 truncate max-w-[200px]"
                                    title={s.title}
                                >
                                    {s.title || s.id}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Article body */}
                <div
                    ref={contentRef}
                    className="wiki-content prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </div>

            <style jsx global>{`
        .wiki-content p {
          color: rgb(203 213 225);
          line-height: 1.8;
          margin-bottom: 1.25rem;
          font-size: 0.9375rem;
        }
        .wiki-h2 {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1.375rem;
          font-weight: 600;
          color: rgb(248 250 252);
          margin-top: 2.5rem;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgb(51 65 85);
          scroll-margin-top: 1.5rem;
        }
        .wiki-h3 {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1.1rem;
          font-weight: 600;
          color: rgb(226 232 240);
          margin-top: 1.75rem;
          margin-bottom: 0.75rem;
          scroll-margin-top: 1.5rem;
        }
        .wiki-code {
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 0.8em;
          background: rgb(15 23 42);
          color: rgb(251 191 36);
          padding: 0.1em 0.4em;
          border: 1px solid rgb(51 65 85);
        }
        .wiki-ul {
          margin-bottom: 1.25rem;
          padding-left: 1.5rem;
          space-y: 0.5rem;
          list-style: none;
        }
        .wiki-ul li {
          color: rgb(203 213 225);
          line-height: 1.7;
          margin-bottom: 0.4rem;
          position: relative;
          padding-left: 1rem;
          font-size: 0.9375rem;
        }
        .wiki-ul li::before {
          content: '◆';
          position: absolute;
          left: -0.25rem;
          color: rgb(251 191 36 / 0.4);
          font-size: 0.5rem;
          top: 0.45em;
        }
        .wiki-content strong {
          color: rgb(248 250 252);
          font-weight: 600;
        }
        .wiki-content em {
          color: rgb(251 191 36 / 0.8);
          font-style: italic;
        }
      `}</style>
        </div>
    );
}