import fs from 'fs';

async function testFetch() {
  const symbol = 'VTSAX';
  const url = `https://www.google.com/finance/quote/${symbol}:MUTF`;
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  };
  
  const resp = await fetch(url, { headers });
  const html = await resp.text();
  const match = html.match(/data-last-price="([0-9\.]+)"/);
  console.log('Google Finance price:', match ? match[1] : 'not found');
}

testFetch();
