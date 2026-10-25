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

async function testRaw(modelName) {
  console.log(`\n=== Testing raw call for model: "${modelName}" ===`);
  try {
    const model = ai.getGenerativeModel({ model: modelName });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      generationConfig: { maxOutputTokens: 100 },
    });
    console.log('Result response:', result.response.text());
  } catch (err) {
    console.log('ERROR CAUGHT:');
    console.log('Type:', err?.constructor?.name);
    console.log('Message:', err?.message);
    console.log('Status:', err?.status);
    console.log('Cause:', err?.cause);
    console.log('Full error stringified:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  }
}

async function run() {
  await testRaw('gemini-3.5-flash-lit');
  await testRaw('gemini-3.5-flash-lite');
}

run();
