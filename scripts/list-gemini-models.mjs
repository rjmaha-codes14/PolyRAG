import fs from 'fs';
import path from 'path';

// 1. Read GEMINI_API_KEY from .env
function getApiKey() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env file not found at:', envPath);
    return null;
  }
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('GEMINI_API_KEY=')) {
      const rawVal = trimmed.slice('GEMINI_API_KEY='.length).trim();
      return rawVal.replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

async function listModels() {
  const apiKey = getApiKey();
  console.log('--- GEMINI API DIAGNOSTICS & LIST MODELS ---');
  if (!apiKey) {
    console.error('ERROR: GEMINI_API_KEY not found in .env');
    return;
  }
  console.log(`API Key found (length: ${apiKey.length}, preview: ${apiKey.slice(0, 6)}...${apiKey.slice(-4)})`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  console.log('Calling Google Gemini ListModels endpoint...');

  try {
    const startTime = Date.now();
    const res = await fetch(url);
    const duration = Date.now() - startTime;
    console.log(`HTTP Status: ${res.status} ${res.statusText} (${duration}ms)`);

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('Non-JSON response received:', text);
      return;
    }

    if (!res.ok) {
      console.error('API Error Response:');
      console.error(JSON.stringify(data, null, 2));
      return;
    }

    const models = data.models || [];
    console.log(`\nSuccessfully fetched ${models.length} total models.`);

    const generateModels = [];
    const embedModels = [];

    for (const m of models) {
      const name = m.name?.replace(/^models\//, '') || m.name;
      const methods = m.supportedGenerationMethods || [];
      const isGenerate = methods.includes('generateContent');
      const isEmbed = methods.includes('embedContent') || methods.includes('batchEmbedContents');

      if (isGenerate) {
        generateModels.push({
          name,
          displayName: m.displayName,
          methods,
          description: m.description,
        });
      }
      if (isEmbed) {
        embedModels.push({
          name,
          displayName: m.displayName,
          methods,
        });
      }
    }

    console.log('\n========================================');
    console.log(`MODELS SUPPORTING generateContent (${generateModels.length}):`);
    console.log('========================================');
    generateModels.forEach(m => {
      console.log(`- ${m.name} [${m.displayName || ''}]`);
    });

    console.log('\n========================================');
    console.log(`MODELS SUPPORTING embedContent (${embedModels.length}):`);
    console.log('========================================');
    embedModels.forEach(m => {
      console.log(`- ${m.name} [${m.displayName || ''}]`);
    });

  } catch (err) {
    console.error('\nNetwork or Connection Error:');
    console.error('Name:', err.name);
    console.log('Code:', err.code);
    console.error('Message:', err.message);
    if (err.cause) {
      console.error('Cause:', err.cause);
    }
  }
}

listModels();
