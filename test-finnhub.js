import fs from 'fs';

async function testFetch() {
  const symbol = 'VTSAX';
  const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
  if (!FINNHUB_API_KEY) {
    console.log("No finnhub key");
    return;
  }
  const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`);
  const data = await response.json();
  console.log(data);
}

testFetch();
