import fs from 'fs';

async function testFetch() {
  const url = `http://localhost:3000/api/prices`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"invalid": true' // missing closing brace
  });
  const text = await resp.text();
  console.log("Status:", resp.status);
  console.log("Response:", text.substring(0, 50));
}

testFetch();
