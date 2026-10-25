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

async function testFetch(model, body, method = 'generateContent') {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}?key=${apiKey}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const duration = Date.now() - t0;
    const data = await res.json();
    console.log(`[${model}] :${method} -> ${res.status} ${res.statusText} (${duration}ms)`);
    if (!res.ok) {
      console.log('Error payload:', JSON.stringify(data));
    } else {
      if (method === 'generateContent') {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log('Response text:', text?.trim()?.slice(0, 100));
      } else if (method === 'embedContent') {
        console.log('Vector dim:', data.embedding?.values?.length);
      }
    }
  } catch (err) {
    console.error(`[${model}] Network error:`, err);
  }
}

async function run() {
  console.log('Testing generateContent candidates:');
  await testFetch('gemini-3.8-flash', {
    contents: [{ parts: [{ text: 'Hello, respond with: "Gemini 3.8 Flash is online!"' }] }]
  });

  await testFetch('gemini-3.1-flash-lite', {
    contents: [{ parts: [{ text: 'Hello' }] }]
  });

  console.log('\nTesting embedContent candidates:');
  await testFetch('gemini-embedding-001', {
    content: { parts: [{ text: 'Hello embedding test' }] }
  }, 'embedContent');

  await testFetch('gemini-embedding-2', {
    content: { parts: [{ text: 'Hello embedding test' }] }
  }, 'embedContent');
}

run();
