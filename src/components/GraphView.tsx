"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

// react-force-graph-2d must be imported dynamically with SSR disabled
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

export interface GraphRelation {
    entity: string;
    relation: string;
    target: string;
}

interface Props {
    relations: GraphRelation[];
    topic: string;
    className?: string;
}

export function GraphView({ relations, topic, className }: Props) {
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

    useEffect(() => {
        if (!containerRef.current) return;
        const { clientWidth } = containerRef.current;
        setDimensions({ width: clientWidth, height: 400 });
        
        const handleResize = () => {
            if (containerRef.current) {
                setDimensions({ width: containerRef.current.clientWidth, height: 400 });
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const graphData = useMemo(() => {
        const nodesMap = new Map();
        const links: any[] = [];

        // Add topic node
        nodesMap.set(topic, { id: topic, name: topic, val: 8, color: "#fbbf24" }); // Amber-400

        relations.slice(0, 100).forEach(rel => {
            if (!nodesMap.has(rel.entity)) {
                nodesMap.set(rel.entity, { id: rel.entity, name: rel.entity, val: 2, color: "#64748b" }); // Slate-500
            } else {
                nodesMap.get(rel.entity).val += 0.5;
            }

            if (!nodesMap.has(rel.target)) {
                nodesMap.set(rel.target, { id: rel.target, name: rel.target, val: 2, color: "#64748b" });
            } else {
                nodesMap.get(rel.target).val += 0.5;
            }

            links.push({
                source: rel.entity,
                target: rel.target,
                label: rel.relation
            });
        });

        return {
            nodes: Array.from(nodesMap.values()),
            links
        };
    }, [relations, topic]);

    const handleNodeClick = useCallback((node: any) => {
        setSelectedNode(node.id === selectedNode ? null : node.id);
    }, [selectedNode]);

    const selectedRelations = useMemo(() => {
        if (!selectedNode) return [];
        return graphData.links.filter(l => 
            (typeof l.source === 'object' ? l.source.id === selectedNode : l.source === selectedNode) || 
            (typeof l.target === 'object' ? l.target.id === selectedNode : l.target === selectedNode)
        );
    }, [selectedNode, graphData.links]);

    if (relations.length === 0) {
        return (
            <div className={cn("flex items-center justify-center h-64 border border-slate-800", className)}>
                <p className="font-mono text-xs text-slate-600">No graph data — ingest a topic first</p>
            </div>
        );
    }

    return (
        <div className={cn("space-y-3", className)}>
            {/* Stats bar */}
            <div className="flex gap-6 font-mono text-xs">
                <span className="text-slate-500">
                    Nodes: <span className="text-amber-400">{graphData.nodes.length}</span>
                </span>
                <span className="text-slate-500">
                    Edges: <span className="text-amber-400">{graphData.links.length}</span>
                </span>
                {selectedNode && (
                    <span className="text-slate-500">
                        Selected: <span className="text-indigo-400">{selectedNode}</span>
                    </span>
                )}
            </div>

            <div ref={containerRef} className="border border-slate-800 h-[400px] w-full overflow-hidden bg-slate-950 relative">
                <ForceGraph2D
                    width={dimensions.width}
                    height={dimensions.height}
                    graphData={graphData}
                    nodeLabel="name"
                    nodeColor={node => selectedNode === node.id ? "#818cf8" : node.color}
                    linkColor={() => "rgba(71,85,105,0.4)"}
                    onNodeClick={handleNodeClick}
                    nodeRelSize={4}
                    d3VelocityDecay={0.3}
                />
            </div>

            {/* Selected node relations */}
            {selectedNode && selectedRelations.length > 0 && (
                <div className="border border-slate-800 bg-slate-950 p-4 space-y-2">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                        Relations for "{selectedNode}"
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                        {selectedRelations.map((r, i) => {
                            const src = typeof r.source === 'object' ? r.source.id : r.source;
                            const tgt = typeof r.target === 'object' ? r.target.id : r.target;
                            return (
                                <div key={i} className="flex items-center gap-2 font-mono text-xs">
                                    <span className="text-slate-300 truncate max-w-[120px]">{src}</span>
                                    <span className="text-amber-500/60 shrink-0">→ {r.label} →</span>
                                    <span className="text-slate-300 truncate max-w-[120px]">{tgt}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            <p className="font-mono text-[9px] text-slate-700">
                Click a node to inspect its relations • Gold = topic node • Force-directed layout
            </p>
        </div>
    );
}