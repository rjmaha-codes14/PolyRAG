import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

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
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`;
const headers = {
  'Content-Type': 'application/json',
  'x-goog-api-client': 'genai-js/0.21.0',
  'x-goog-api-key': apiKey
};
const body = JSON.stringify({
  contents: [{ role: 'user', parts: [{ text: 'Say hello in Tamil and English' }] }]
});

console.log('Sending request with dns.setDefaultResultOrder("ipv4first")...');
const t0 = Date.now();
try {
  const res = await fetch(url, { method: 'POST', headers, body });
  const ms = Date.now() - t0;
  console.log(`HTTP ${res.status} ${res.statusText} in ${ms}ms!`);
  const data = await res.json();
  console.log('Text:', data.candidates?.[0]?.content?.parts?.[0]?.text);
} catch (err) {
  console.error('Fetch threw error:', err);
}
