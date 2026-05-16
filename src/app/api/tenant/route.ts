// app/api/tenant/route.ts
// One-time tenant setup — call this once before anything else.
// Safe to call multiple times (idempotent).

import { NextResponse } from "next/server";
import { createTenant, waitForTenant, getTenantStatus, TENANT_ID } from "@/lib/hydra";

export async function POST() {
    try {
        // Try to get status first — if tenant exists, just return ready
        try {
            const status = await getTenantStatus(TENANT_ID);
            const { graph_status, vectorstore_status } = status.infra;
            if (graph_status && vectorstore_status[0] && vectorstore_status[1]) {
                return NextResponse.json({ status: "ready", tenant_id: TENANT_ID });
            }
        } catch {
            // Tenant doesn't exist yet — create it
        }

        await createTenant(TENANT_ID);
        await waitForTenant(TENANT_ID);

        return NextResponse.json({ status: "ready", tenant_id: TENANT_ID });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function GET() {
    try {
        const status = await getTenantStatus(TENANT_ID);
        return NextResponse.json(status);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}