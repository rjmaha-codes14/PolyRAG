import dotenv from 'dotenv';
dotenv.config();

import { checkGeminiHealth } from '../lib/gemini.ts';

async function test() {
  const res = await checkGeminiHealth();
  console.log('checkGeminiHealth result:', res);
}

test();
