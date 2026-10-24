import { GoogleGenerativeAI } from '@google/generative-ai';

// Clean environment variable values (remove surrounding quotes and whitespace)
function cleanEnvVar(val: string | undefined): string {
  if (!val) return '';
  return val.replace(/^["']|["']$/g, '').trim();
}

// Retrieve model names from environment variables with current, official non-deprecated defaults
export function getGeminiModelName(): string {
  const model = cleanEnvVar(process.env.GEMINI_MODEL);
  return model || 'gemini-3.5-flash-lite';
}

export function getGeminiEmbedModelName(): string {
  const model = cleanEnvVar(process.env.GEMINI_EMBED_MODEL);
  return model || 'gemini-embedding-001';
}

let genAIInstance: GoogleGenerativeAI | null = null;
let cachedApiKey: string | null = null;

export function getGoogleGenAI(): GoogleGenerativeAI {
  const apiKey = cleanEnvVar(process.env.GEMINI_API_KEY);
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    throw new Error('GEMINI_API_KEY is not set or empty in environment.');
  }
  if (!genAIInstance || cachedApiKey !== apiKey) {
    genAIInstance = new GoogleGenerativeAI(apiKey);
    cachedApiKey = apiKey;
  }
  return genAIInstance;
}

export interface GeminiHealthStatus {
  available: boolean;
  model: string;
  embedModel: string;
  reason?: string;
}

let lastHealthCheck: { time: number; status: GeminiHealthStatus } | null = null;

/**
 * Health check self-test for Gemini API and configured models.
 * Cached for 30 seconds only on success to prevent repeated rate limits.
 */
export async function checkGeminiHealth(): Promise<GeminiHealthStatus> {
  const now = Date.now();
  if (lastHealthCheck && lastHealthCheck.status.available && now - lastHealthCheck.time < 30_000) {
    return lastHealthCheck.status;
  }

  const apiKey = cleanEnvVar(process.env.GEMINI_API_KEY);
  const modelName = getGeminiModelName();
  const embedModelName = getGeminiEmbedModelName();

  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    const status: GeminiHealthStatus = {
      available: false,
      model: modelName,
      embedModel: embedModelName,
      reason: 'GEMINI_API_KEY is missing or unconfigured in .env',
    };
    lastHealthCheck = null;
    return status;
  }

  try {
    const ai = getGoogleGenAI();
    const model = ai.getGenerativeModel({ model: modelName });
    // Run a test prompt with sufficient maxOutputTokens (100)
    // Models with internal thinking tokens need enough headroom to output response text
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      generationConfig: { maxOutputTokens: 100 },
    });

    if (result.response.promptFeedback?.blockReason) {
      throw new Error(`Blocked by Gemini safety filter (${result.response.promptFeedback.blockReason})`);
    }

    const candidate = result.response.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
      if (candidate.finishReason === 'SAFETY') {
        throw new Error('Blocked by Gemini safety filters (SAFETY)');
      }
      if (candidate.finishReason === 'RECITATION') {
        throw new Error('Blocked by Gemini recitation check (RECITATION)');
      }
      throw new Error(`Gemini finish reason: ${candidate.finishReason}`);
    }

    let text = '';
    try {
      text = result.response.text().trim();
    } catch {
      const parts = candidate?.content?.parts || [];
      text = parts
        .filter((p: any) => typeof p?.text === 'string')
        .map((p: any) => p.text)
        .join('')
        .trim();
    }

    if (text) {
      const status: GeminiHealthStatus = {
        available: true,
        model: modelName,
        embedModel: embedModelName,
      };
      lastHealthCheck = { time: now, status };
      return status;
    }

    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw new Error('Thinking or output tokens exhausted before text could be returned (MAX_TOKENS)');
    }

    throw new Error(`Empty response received from Gemini model "${modelName}" (finishReason: ${candidate?.finishReason || 'unknown'})`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    let reason = errorMsg;

    if (
      errorMsg.includes('API_KEY_INVALID') ||
      errorMsg.includes('API key not valid') ||
      errorMsg.includes('403') ||
      errorMsg.includes('PERMISSION_DENIED')
    ) {
      reason = 'Invalid or unauthorized GEMINI_API_KEY (check your key in .env)';
    } else if (
      errorMsg.includes('404') ||
      errorMsg.includes('not found') ||
      errorMsg.includes('is no longer available') ||
      errorMsg.includes('retired') ||
      errorMsg.includes('deprecated')
    ) {
      reason = `Model "${modelName}" not found or retired (check GEMINI_MODEL in .env)`;
    } else if (
      errorMsg.includes('RESOURCE_EXHAUSTED') ||
      errorMsg.includes('429') ||
      errorMsg.includes('quota')
    ) {
      reason = 'Gemini API quota exceeded or rate limited (429)';
    } else if (errorMsg.includes('SAFETY') || errorMsg.includes('safety')) {
      reason = 'Blocked by Gemini safety filters';
    } else if (
      errorMsg.includes('ENOTFOUND') ||
      errorMsg.includes('ECONNREFUSED') ||
      errorMsg.includes('fetch failed')
    ) {
      reason = 'Network error: cannot connect to Google Gemini API servers';
    }

    const status: GeminiHealthStatus = {
      available: false,
      model: modelName,
      embedModel: embedModelName,
      reason,
    };
    lastHealthCheck = null;
    return status;
  }
}

/**
 * Fast structured-output language detection call for disambiguation
 * (e.g. Devanagari: Hindi vs Marathi vs Nepali; Arabic: Urdu vs Kashmiri vs Sindhi; Latin: Tanglish vs Hinglish).
 */
export async function detectLanguageWithGemini(
  text: string,
  candidateLanguages: string[]
): Promise<{ languageCode: string; script: string; isRomanized: boolean; confidence: number }> {
  try {
    const ai = getGoogleGenAI();
    const model = ai.getGenerativeModel({
      model: getGeminiModelName(),
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 200,
        temperature: 0.1,
      },
    });

    const prompt = `Analyze this message and identify its exact language:
Text: "${text.slice(0, 300)}"
Candidates: ${candidateLanguages.join(', ')}

Return JSON with this exact schema:
{
  "languageCode": "two or three letter ISO code (e.g. hi, mr, ne, ta, te, ur, en, as, bn, kn, ml, gu, pa, or)",
  "script": "Script name (e.g. Devanagari, Tamil, Telugu, Latin, Arabic, Bengali)",
  "isRomanized": boolean (true if an Indian language written in Latin/English alphabets like Hinglish or Tanglish),
  "confidence": number between 0 and 1
}`;

    const resp = await model.generateContent(prompt);
    const jsonStr = resp.response.text();
    const parsed = JSON.parse(jsonStr);
    return {
      languageCode: parsed.languageCode || candidateLanguages[0] || 'en',
      script: parsed.script || 'Unknown',
      isRomanized: Boolean(parsed.isRomanized),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
    };
  } catch (error) {
    console.warn('Gemini language disambiguation failed, falling back to heuristic candidate:', error);
    return {
      languageCode: candidateLanguages[0] || 'en',
      script: 'Auto',
      isRomanized: false,
      confidence: 0.7,
    };
  }
}

/**
 * Generate embedding for a single text with retry and exponential backoff
 */
export async function generateSingleEmbedding(text: string): Promise<number[]> {
  const ai = getGoogleGenAI();
  const embedModel = ai.getGenerativeModel({ model: getGeminiEmbedModelName() });

  let attempts = 0;
  const maxAttempts = 4;
  let delay = 1000;

  while (attempts < maxAttempts) {
    try {
      const result = await embedModel.embedContent(text);
      if (result.embedding?.values) {
        return result.embedding.values;
      }
      throw new Error('No embedding values returned');
    } catch (err: unknown) {
      attempts++;
      const msg = err instanceof Error ? err.message : String(err);
      if ((msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) && attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      if (attempts >= maxAttempts) throw err;
    }
  }
  throw new Error('Failed to generate embedding after retries');
}

/**
 * Batch generate embeddings with throttling to respect Gemini rate limits
 */
export async function batchGenerateEmbeddings(
  texts: string[],
  batchSize: number = 5,
  throttleMs: number = 300
): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const chunk = texts.slice(i, i + batchSize);
    const chunkPromises = chunk.map((t) => generateSingleEmbedding(t));
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);

    if (i + batchSize < texts.length && throttleMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, throttleMs));
    }
  }

  return results;
}

/**
 * OCR Vision extraction using Gemini multimodal model
 * Extracts text from an image buffer with Indic script fidelity (Tamil, Hindi, etc.)
 */
export async function extractTextWithGeminiVision(
  imageBuffer: Buffer,
  mimeType: string,
  hintLanguage?: string
): Promise<string> {
  const ai = getGoogleGenAI();
  const model = ai.getGenerativeModel({ model: getGeminiModelName() });

  const base64Data = imageBuffer.toString('base64');
  const prompt = `Extract ALL readable text from this document image with highest accuracy.
Keep the exact words, sentences, layout, numbers, and punctuation.
Support Indic scripts (Tamil, Hindi, Telugu, Bengali, Kannada, Malayalam, Marathi, Gujarati, Gurmukhi, Odia, Urdu, etc.) faithfully.
${hintLanguage ? `Primary document language hint: ${hintLanguage}` : ''}
Do not add conversational commentary or explanations; output only the extracted document text.`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    },
  ]);

  return result.response.text().trim();
}

/**
 * Generate a short, max 5-word title for a conversation in the user's language
 */
export async function generateConversationTitle(firstMessage: string, langName: string = 'English'): Promise<string> {
  try {
    const ai = getGoogleGenAI();
    const model = ai.getGenerativeModel({
      model: getGeminiModelName(),
      generationConfig: { maxOutputTokens: 100, temperature: 0.3 },
    });
    const prompt = `Generate a concise title of at most 5 words for a chat that starts with this message:
"${firstMessage.slice(0, 200)}"
The title must be in the language "${langName}".
Return ONLY the title text, with no quotes or punctuation.`;

    const res = await model.generateContent(prompt);
    let title = res.response.text().trim();
    // Strip surrounding quotes
    title = title.replace(/^["']|["']$/g, '').trim();
    const words = title.split(/\s+/);
    if (words.length > 5) {
      title = words.slice(0, 5).join(' ');
    }
    return title || 'New Chat';
  } catch {
    return 'New Chat';
  }
}
