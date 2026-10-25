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

async function testModel(modelName) {
  try {
    console.log(`Testing generateContent with ${modelName}...`);
    const model = ai.getGenerativeModel({ model: modelName });
    const res = await model.generateContent('Hi');
    console.log(` SUCCESS with ${modelName}:`, res.response.text().trim().slice(0, 100));
    return true;
  } catch (err) {
    console.error(` FAILED with ${modelName}:`, err.message);
    return false;
  }
}

async function testEmbed(modelName) {
  try {
    console.log(`Testing embedContent with ${modelName}...`);
    const model = ai.getGenerativeModel({ model: modelName });
    const res = await model.embedContent('hello world');
    console.log(` SUCCESS with ${modelName}: vector length =`, res.embedding.values.length);
    return true;
  } catch (err) {
    console.error(` FAILED with ${modelName}:`, err.message);
    return false;
  }
}

async function run() {
  // Candidate fast models:
  await testModel('gemini-2.5-flash');
  await testModel('gemini-3.5-flash');
  await testModel('gemini-3.8-flash');
  await testModel('gemini-2.5-flash-lite');

  // Candidate embedding models:
  await testEmbed('gemini-embedding-001');
  await testEmbed('gemini-embedding-2');
}

run();
