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

// Exactly simulate what @google/generative-ai does:
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`;
const headers = {
  'Content-Type': 'application/json',
  'x-goog-api-client': 'genai-js/0.21.0',
  'x-goog-api-key': apiKey
};
const body = JSON.stringify({
  contents: [{ role: 'user', parts: [{ text: 'ping' }] }]
});

console.log('Sending exact simulated request...');
try {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body
  });
  console.log('Response status:', res.status, res.statusText);
  const text = await res.text();
  console.log('Response body:', text);
} catch (err) {
  console.error('Fetch threw error:', err);
  if (err.cause) {
    console.error('Underlying cause:', err.cause);
  }
}
