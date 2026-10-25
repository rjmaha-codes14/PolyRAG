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

async function testWithTimeout(model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Respond with "READY"' }] }] }),
      signal: controller.signal
    });
    clearTimeout(timer);
    const data = await res.json();
    if (res.ok) {
      console.log(`${model} => SUCCESS:`, data.candidates?.[0]?.content?.parts?.[0]?.text?.trim());
      return true;
    } else {
      console.log(`${model} => HTTP ${res.status}:`, data.error?.message);
      return false;
    }
  } catch (err) {
    clearTimeout(timer);
    console.log(`${model} => ERROR:`, err.message);
    return false;
  }
}

async function main() {
  for (const m of ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash']) {
    await testWithTimeout(m);
  }
}

main();
