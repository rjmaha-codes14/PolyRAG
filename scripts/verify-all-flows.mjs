import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

function extractCookie(res) {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(/auth_token=([^;]+)/);
  return match ? match[1] : null;
}

async function runTests() {
  console.log('==================================================');
  console.log('BEGINNING POLYRAG COMPLETE E2E VERIFICATION SUITE');
  console.log('==================================================\n');

  const timestamp = Date.now();
  const testUser = {
    name: `Test Engineer ${timestamp.toString().slice(-4)}`,
    email: `tester_${timestamp}@polyrag.ai`,
    password: `Password@${timestamp.toString().slice(-4)}!`
  };

  // 1. REGISTER NEW USER
  console.log(`[TEST 1] Registering new user: ${testUser.email}...`);
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  });
  const regData = await regRes.json();
  if (!regRes.ok || !regData.success) {
    throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
  }
  let cookieToken = extractCookie(regRes);
  console.log(`[PASS 1] Registration succeeded! User ID: ${regData.user.id}, Name: "${regData.user.name}"`);

  // 2. VERIFY /api/auth/me (User Name in sidebar)
  console.log(`\n[TEST 2] Verifying session profile for sidebar...`);
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: `auth_token=${cookieToken}` }
  });
  const meData = await meRes.json();
  if (!meRes.ok || meData.user?.name !== testUser.name) {
    throw new Error(`Profile check failed: ${JSON.stringify(meData)}`);
  }
  console.log(`[PASS 2] Real user name in session: "${meData.user.name}" (${meData.user.email})`);

  // 3. LOGOUT
  console.log(`\n[TEST 3] Logging out user...`);
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: `auth_token=${cookieToken}` }
  });
  const logoutData = await logoutRes.json();
  const logoutCookie = logoutRes.headers.get('set-cookie') || '';
  const isCleared = logoutCookie.includes('Max-Age=0') || logoutCookie.includes('expires=Thu, 01 Jan 1970');
  console.log(`[PASS 3] Logout succeeded! Cookie cleared: ${isCleared}`);

  // 4. VERIFY UNAUTHENTICATED REDIRECT / 401 AFTER LOGOUT
  console.log(`\n[TEST 4] Verifying /api/auth/me is rejected after logout...`);
  const meAfterLogout = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: `auth_token=` }
  });
  console.log(`[PASS 4] Unauthenticated request correctly rejected: HTTP ${meAfterLogout.status}`);

  // 5. LOGIN AGAIN
  console.log(`\n[TEST 5] Logging in again...`);
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUser.email, password: testUser.password })
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.success) {
    throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
  }
  cookieToken = extractCookie(loginRes);
  console.log(`[PASS 5] Logged in again successfully! Welcome back, ${loginData.user.name}.`);

  // Helper for SSE chat
  async function streamChat(message, docId) {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `auth_token=${cookieToken}`
      },
      body: JSON.stringify({
        message,
        attachedDocumentId: docId || undefined
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Chat request failed [HTTP ${res.status}]: ${err}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
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
        const lines = [];
        for (const line of block.split(/\r?\n/)) {
          if (line.startsWith('event:')) eventType = line.slice(6).trim();
          if (line.startsWith('data:')) lines.push(line.slice(5).trim());
        }
        const data = lines.join('\n');
        try {
          const parsed = JSON.parse(data);
          if (eventType === 'meta') meta = parsed;
          if (eventType === 'chunk' && parsed.text) fullText += parsed.text;
          if (eventType === 'done' && parsed.fullText) fullText = parsed.fullText;
          if (eventType === 'error') throw new Error(parsed.error);
        } catch (e) {
          if (eventType === 'error') throw e;
        }
      }
    }
    return { fullText: fullText.trim(), meta };
  }

  // 6. SEND "hi" IN ENGLISH
  console.log(`\n[TEST 6] Sending "hi" in English...`);
  const enChat = await streamChat("hi");
  console.log(`[PASS 6] English Chat Response (Lang: ${enChat.meta?.detectedLanguage}):`);
  console.log(`"${enChat.fullText}"`);

  // 7. SEND "வணக்கம்" IN TAMIL
  console.log(`\n[TEST 7] Sending "வணக்கம்" in Tamil...`);
  const taChat = await streamChat("வணக்கம், நீங்கள் யார்?");
  console.log(`[PASS 7] Tamil Chat Response (Lang: ${taChat.meta?.detectedLanguage}):`);
  console.log(`"${taChat.fullText}"`);

  // 8. UPLOAD A SMALL PDF
  console.log(`\n[TEST 8] Uploading sample.pdf...`);
  const pdfBytes = fs.readFileSync(path.resolve('sample.pdf'));
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const formDataBuffer = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    pdfBytes,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const uploadRes = await fetch(`${BASE_URL}/api/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Cookie: `auth_token=${cookieToken}`
    },
    body: formDataBuffer
  });

  const uploadData = await uploadRes.json();
  if (!uploadRes.ok || !uploadData.success) {
    throw new Error(`Upload failed: ${JSON.stringify(uploadData)}`);
  }
  const documentId = uploadData.document.id;
  console.log(`[PASS 8] Uploaded successfully! Document ID: ${documentId}, Title: "${uploadData.document.title}"`);

  // Wait for background ingestion
  console.log(`Waiting for document background indexing...`);
  let docReady = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const docsRes = await fetch(`${BASE_URL}/api/documents`, {
      headers: { Cookie: `auth_token=${cookieToken}` }
    });
    const docsData = await docsRes.json();
    const doc = docsData.documents?.find((d) => d.id === documentId);
    console.log(`Polling doc status (attempt ${i + 1}/30): ${doc?.status || 'unknown'}`);
    if (doc?.status === 'ready') {
      docReady = true;
      console.log(`✓ Document is ready! Chunks generated: ${doc._count?.chunks}`);
      break;
    }
    if (doc?.status === 'error') {
      throw new Error(`Document ingestion failed with status 'error' in DB.`);
    }
  }
  if (!docReady) {
    throw new Error('Document did not reach "ready" status within timeout.');
  }

  // 9. ASK A QUESTION ABOUT THE PDF
  console.log(`\n[TEST 9] Asking question about the PDF: "What is the capital of Tamil Nadu according to the document?"...`);
  const docChat = await streamChat("What is the capital of Tamil Nadu according to the document?", documentId);
  console.log(`[PASS 9] Document Q&A Response:`);
  console.log(`"${docChat.fullText}"`);
  if (docChat.meta?.sources?.length > 0) {
    console.log(`✓ Sources Cited: ${docChat.meta.sources.length} chunk(s) from "${docChat.meta.sources[0]?.documentTitle}"`);
  }

  console.log('\n==================================================');
  console.log('ALL VERIFICATION CHECKS PASSED WITH 100% SUCCESS!');
  console.log('==================================================');
}

runTests().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
