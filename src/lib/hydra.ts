// lib/hydra.ts
// Typed HydraDB client — wraps every endpoint WikiMind needs

const BASE_URL = "https://api.hydradb.com";
const API_KEY = process.env.HYDRA_DB_API_KEY!;
export const TENANT_ID = process.env.HYDRA_TENANT_ID ?? "wikimind-main";

function headers(contentType = "application/json") {
    return {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": contentType,
    };
}

async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`HydraDB ${path} → ${res.status}: ${err}`);
    }
    return res.json();
}

async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: headers(),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`HydraDB GET ${path} → ${res.status}: ${err}`);
    }
    return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TenantInfraStatus {
    tenant_id: string;
    infra: {
        scheduler_status: boolean;
        graph_status: boolean;
        vectorstore_status: [boolean, boolean];
    };
}

export interface IngestResult {
    success: boolean;
    results: { source_id: string; filename: string; status: string }[];
    success_count: number;
    failed_count: number;
}

export interface RecallChunk {
    id: string;
    content: string;
    score: number;
    source_id?: string;
}

export interface RecallSource {
    id: string;
    title: string;
    type: string;
    description: string;
    url: string;
    timestamp: string;
}

export interface GraphRelation {
    entity: string;
    relation: string;
    target: string;
}

export interface RecallResult {
    chunks: RecallChunk[];
    sources: RecallSource[];
    graph_context: {
        query_paths: unknown[];
        chunk_relations: { chunk_id: string; relations: GraphRelation[] }[];
        chunk_id_to_group_ids: Record<string, string[]>;
    };
}

// ─── Tenant ───────────────────────────────────────────────────────────────────

export async function createTenant(tenantId: string) {
    return post("/tenants/create", { tenant_id: tenantId });
}

export async function getTenantStatus(tenantId: string): Promise<TenantInfraStatus> {
    return get(`/tenants/infra/status?tenant_id=${tenantId}`);
}

/** Poll until both vector stores and graph are ready (max ~60s) */
export async function waitForTenant(tenantId: string): Promise<void> {
    for (let i = 0; i < 20; i++) {
        const status = await getTenantStatus(tenantId);
        const { graph_status, vectorstore_status } = status.infra;
        if (graph_status && vectorstore_status[0] && vectorstore_status[1]) return;
        await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error("Tenant provisioning timed out after 60s");
}

// ─── Ingestion ────────────────────────────────────────────────────────────────

/**
 * Ingest plain text as a .txt "file" into HydraDB Knowledge.
 * HydraDB expects multipart/form-data with a file blob.
 */
export async function ingestText(
    tenantId: string,
    filename: string,
    text: string
): Promise<IngestResult> {
    const formData = new FormData();
    formData.append("tenant_id", tenantId);
    const blob = new Blob([text], { type: "text/plain" });
    formData.append("files", blob, `${filename}.txt`);

    const res = await fetch(`${BASE_URL}/ingestion/upload_knowledge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}` }, // no Content-Type — let browser set boundary
        body: formData,
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`HydraDB ingest → ${res.status}: ${err}`);
    }
    return res.json();
}

/** Poll until a source_id finishes processing */
export async function waitForProcessing(
    tenantId: string,
    sourceId: string,
    maxWait = 60_000
): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
        const result = await post<{ statuses: { file_id: string; indexing_status: string }[] }>(
            `/ingestion/verify_processing?tenant_id=${tenantId}&file_ids=${sourceId}`,
            {}
        );
        const item = result.statuses?.find((r) => r.file_id === sourceId);
        if (item?.indexing_status === "completed") return;
        if (item?.indexing_status === "failed" || item?.indexing_status === "errored") throw new Error(`Processing failed for ${sourceId}`);
        await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error(`Processing timed out for ${sourceId}`);
}

// ─── Memories ─────────────────────────────────────────────────────────────────

/** Store a user interaction as a Memory (personalization signal) */
export async function addMemory(
    tenantId: string,
    userId: string,
    content: string
): Promise<void> {
    await post("/memories/add_memory", {
        tenant_id: tenantId,
        sub_tenant_id: userId,
        content,
    });
}

// ─── Recall ───────────────────────────────────────────────────────────────────

/** Full hybrid recall over Knowledge graph */
export async function recall(
    tenantId: string,
    query: string,
    opts?: {
        userId?: string;
        maxResults?: number;
        mode?: "fast" | "thinking";
        alpha?: number | "auto";
        graphContext?: boolean;
    }
): Promise<RecallResult> {
    return post("/recall/full_recall", {
        tenant_id: tenantId,
        sub_tenant_id: opts?.userId,
        query,
        mode: opts?.mode ?? "thinking",
        max_results: opts?.maxResults ?? 15,
        alpha: opts?.alpha ?? 0.8,
        graph_context: opts?.graphContext ?? true,
    });
}

/** Recall user memories (preferences / personalization) */
export async function recallMemories(
    tenantId: string,
    userId: string,
    query: string
): Promise<RecallResult> {
    return post("/recall/recall_preferences", {
        tenant_id: tenantId,
        sub_tenant_id: userId,
        query,
        mode: "thinking",
        max_results: 10,
    });
}

// ─── Graph ────────────────────────────────────────────────────────────────────

export interface GraphRelationsResult {
    source_id: string;
    relations: GraphRelation[];
}

/** Get entity relationships for a given source_id */
export async function getGraphRelations(
    tenantId: string,
    sourceId: string
): Promise<GraphRelationsResult> {
    return get(
        `/list/graph_relations_by_id?tenant_id=${tenantId}&source_id=${sourceId}`
    );
}

// ─── List ─────────────────────────────────────────────────────────────────────

export interface ListResult {
    items: RecallSource[];
    total: number;
    page: number;
}

/** Paginated list of all ingested knowledge sources */
export async function listKnowledge(
    tenantId: string,
    page = 1,
    pageSize = 20
): Promise<ListResult> {
    return post("/list/data", {
        tenant_id: tenantId,
        type: "knowledge",
        page,
        page_size: pageSize,
    });
}