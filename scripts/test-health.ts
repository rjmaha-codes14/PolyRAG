import { checkGeminiHealth } from '../lib/gemini';

async function test() {
  const res = await checkGeminiHealth();
  console.log('checkGeminiHealth result:', res);
}

test();
