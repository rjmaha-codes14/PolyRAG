async function testLogin() {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@polyrag.ai', password: 'Demo@12345' })
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Response:', data);
  console.log('Set-Cookie:', res.headers.get('set-cookie'));
}

testLogin();
