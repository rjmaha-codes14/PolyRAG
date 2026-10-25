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

async function testCause() {
  try {
    const model = ai.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });
    await model.generateContent('ping');
  } catch (err) {
    console.log('Main error:', err);
    let cur = err;
    let depth = 0;
    while (cur && depth < 5) {
      console.log(`Depth ${depth}:`, {
        name: cur.name,
        message: cur.message,
        code: cur.code,
        errno: cur.errno,
        syscall: cur.syscall,
        hostname: cur.hostname,
        cause: cur.cause ? true : false
      });
      cur = cur.cause;
      depth++;
    }
  }
}

testCause();
