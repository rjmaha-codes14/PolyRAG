import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'polyrag-enterprise-secure-jwt-secret-key-32chars';
const secretKey = new TextEncoder().encode(JWT_SECRET);

async function getToken() {
  let user = await prisma.user.findUnique({ where: { email: 'demo@polyrag.ai' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'demo@polyrag.ai',
        name: 'Demo User',
        passwordHash: 'dummy',
        defaultLanguage: 'auto',
      }
    });
  }
  const token = await new SignJWT({ userId: user.id, email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);
  return token;
}

async function sendChat(token, message, manualLanguageOverride) {
  console.log(`\n========================================`);
  console.log(`SENDING CHAT: "${message}" ${manualLanguageOverride ? `(Language: ${manualLanguageOverride})` : ''}`);
  console.log(`========================================`);

  const res = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `auth_token=${token}`
    },
    body: JSON.stringify({
      message,
      manualLanguageOverride
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`HTTP ${res.status}:`, errText);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullAnswer = '';
  let meta = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || '';

    for (const block of blocks) {
      if (!block.trim()) continue;
      let eventType = 'chunk';
      const dataLines = [];
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) eventType = line.slice(6).trim();
        if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      const data = dataLines.join('\n');
      try {
        const parsed = JSON.parse(data);
        if (eventType === 'meta') {
          meta = parsed;
        } else if (eventType === 'chunk') {
          if (parsed.text) fullAnswer += parsed.text;
        } else if (eventType === 'done') {
          if (parsed.fullText) fullAnswer = parsed.fullText;
        } else if (eventType === 'error') {
          console.error('SSE Error:', parsed.error);
        }
      } catch {
        // raw string
      }
    }
  }

  console.log('Detected Language:', meta?.detectedLanguage, `(${meta?.script})`);
  console.log('AI Response:\n', fullAnswer.trim());
}

async function run() {
  try {
    const token = await getToken();
    // Test 1: English "hi"
    await sendChat(token, "hi");

    // Test 2: Tamil "hi" / "வணக்கம்"
    await sendChat(token, "வணக்கம், நீங்கள் யார்?");

    // Test 3: "hi" with manualLanguageOverride: 'ta'
    await sendChat(token, "hi", "ta");
  } catch (err) {
    console.error('Test run error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
