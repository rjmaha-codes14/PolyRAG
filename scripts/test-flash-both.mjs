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

async function testSingle(m) {
  try {
    const t0 = Date.now();
    const model = ai.getGenerativeModel({ model: m });
    const res = await model.generateContent('Say hello in Tamil and English');
    console.log(`[${m}] SUCCESS (${Date.now() - t0}ms):`, res.response.text().trim());
  } catch (err) {
    console.log(`[${m}] FAIL:`, err.message);
  }
}

async function run() {
  await testSingle('gemini-3.5-flash-lite');
  await testSingle('gemini-3.5-flash');
}

run();
