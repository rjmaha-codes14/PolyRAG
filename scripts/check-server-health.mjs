async function testHealth() {
  const res = await fetch('http://localhost:3000/api/health');
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Health Data:', JSON.stringify(data, null, 2));
}

testHealth();
