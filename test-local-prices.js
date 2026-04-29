import fs from 'fs';

async function testFetch() {
  const url = `http://localhost:3000/api/prices?tickers=VTSAX,VTIAX,AAPL,MSFT&clearCache=true`;
  console.log('Fetching from:', url);
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.log('Error status:', resp.status);
      console.log('Error response:', await resp.text());
      return;
    }
    const data = await resp.json();
    console.log("Prices returned:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}

testFetch();
