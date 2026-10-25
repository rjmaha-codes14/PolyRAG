import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

function getApiKey() {
  const envPath = path.resolve(process.cwd(), '.env');
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('GEMINI_API_KEY=')) {
      return trimmed.slice('GEMINI_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

const apiKey = getApiKey();
const ai = new GoogleGenerativeAI(apiKey);

async function testEmbeddings() {
  for (const m of ['gemini-embedding-001', 'gemini-embedding-2']) {
    try {
      console.log(`Testing embedding model: ${m}...`);
      const model = ai.getGenerativeModel({ model: m });
      const res = await model.embedContent('Testing multilingual Indic embeddings');
      console.log(`SUCCESS for ${m}: length = ${res.embedding.values.length}`);
    } catch (err) {
      console.error(`FAILED for ${m}:`, err.message);
    }
  }
}

testEmbeddings();
