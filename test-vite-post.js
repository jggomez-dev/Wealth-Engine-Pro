import fs from 'fs';

async function testFetch() {
  const url = `http://localhost:3000/some-random-url`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const text = await resp.text();
  console.log("Status:", resp.status);
  console.log("Response:", text.substring(0, 50));
}

testFetch();
