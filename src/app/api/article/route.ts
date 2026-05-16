import { NextRequest, NextResponse } from "next/server";
import { getArticle } from "@/lib/storage";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const topic = url.searchParams.get("topic");

    if (!topic) {
        return NextResponse.json({ error: "Missing topic" }, { status: 400 });
    }

    const data = await getArticle(topic);
    if (!data) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json(data);
}
