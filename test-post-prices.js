import fs from 'fs';

async function testFetch() {
  const url = `http://localhost:3000/api/prices`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tickers: "AAPL,MSFT", clearCache: true })
  });
  const text = await resp.text();
  console.log("Status:", resp.status);
  console.log("Response:", text);
}

testFetch();
