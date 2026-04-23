import fs from 'fs';

async function testFetch() {
  const url = `http://localhost:3000/api/prices?tickers=VTI`;
  const resp = await fetch(url);
  const data = await resp.json();
  console.log(JSON.stringify(data, null, 2));
}

testFetch();
