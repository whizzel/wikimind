import fs from 'fs/promises';
import path from 'path';

const DB_FILE = path.join(process.cwd(), '.data', 'articles.json');

export interface StoredArticle {
    topic: string;
    article: string;
    sourceIds: string[];
    timestamp: number;
}

export async function saveArticle(topic: string, article: string, sourceIds: string[]) {
    await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
    let data: Record<string, StoredArticle> = {};
    try {
        const content = await fs.readFile(DB_FILE, 'utf-8');
        data = JSON.parse(content);
    } catch (e) {
        // File doesn't exist or is invalid
    }
    
    data[topic.toLowerCase()] = {
        topic,
        article,
        sourceIds,
        timestamp: Date.now()
    };
    
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

export async function getArticle(topic: string): Promise<StoredArticle | null> {
    try {
        const content = await fs.readFile(DB_FILE, 'utf-8');
        const data: Record<string, StoredArticle> = JSON.parse(content);
        return data[topic.toLowerCase()] || null;
    } catch (e) {
        return null;
    }
}
