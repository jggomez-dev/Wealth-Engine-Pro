import fs from 'fs';

async function testFetch() {
  const url = `http://localhost:3000/api/prices`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tickers: "VTSAX,VTIAX,FZROX,BRK-B", clearCache: true })
  });
  const data = await resp.json();
  console.log("Status:", resp.status);
  console.log("Response:", data);
}

testFetch();
