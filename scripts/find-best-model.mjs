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

const modelsToTest = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
];

async function testOne(model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say "OK"' }] }]
      })
    });
    const ms = Date.now() - t0;
    const data = await res.json();
    if (res.ok) {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      console.log(`[PASS] ${model}: ${res.status} in ${ms}ms -> "${text}"`);
      return true;
    } else {
      console.log(`[FAIL] ${model}: ${res.status} (${data.error?.message?.slice(0, 80)})`);
      return false;
    }
  } catch (err) {
    console.log(`[ERR] ${model}: ${err.message}`);
    return false;
  }
}

async function run() {
  for (const m of modelsToTest) {
    await testOne(m);
  }
}

run();
