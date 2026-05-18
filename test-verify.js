require('dotenv').config();
const TENANT_ID = process.env.HYDRA_TENANT_ID ?? "wikimind-main";
const BASE_URL = "https://api.hydradb.com";
const API_KEY = process.env.HYDRA_DB_API_KEY;

async function check() {
    const res = await fetch(`${BASE_URL}/ingestion/verify_processing?tenant_id=${TENANT_ID}&file_ids=89d0a3b91b35d8c749aee690085195d7`, {
        method: "POST",
        headers: { 
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({})
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
}
check().catch(console.error);
