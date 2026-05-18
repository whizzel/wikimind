require('dotenv').config();
const TENANT_ID = process.env.HYDRA_TENANT_ID ?? "wikimind-main";
const BASE_URL = "https://api.hydradb.com";
const API_KEY = process.env.HYDRA_DB_API_KEY;

async function ingestText(tenantId, filename, text) {
    const formData = new FormData();
    formData.append("tenant_id", tenantId);
    const blob = new Blob([text], { type: "text/plain" });
    formData.append("files", blob, `${filename}.txt`);

    const res = await fetch(`${BASE_URL}/ingestion/upload_knowledge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}` }, 
        body: formData,
    });
    console.log("Status:", res.status);
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`HydraDB ingest → ${res.status}: ${err}`);
    }
    const textRes = await res.text();
    console.log("Body start:", textRes.slice(0, 100));
}

ingestText(TENANT_ID, "test-file", "This is a test document.").catch(console.error);
