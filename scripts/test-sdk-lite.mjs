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

async function testOnlyLite() {
  console.log('Testing @google/generative-ai with gemini-3.5-flash-lite...');
  try {
    const model = ai.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      generationConfig: { maxOutputTokens: 100 },
    });
    console.log('SUCCESS! Text returned:', result.response.text());
  } catch (err) {
    console.error('FAILED:', err);
  }
}

testOnlyLite();
