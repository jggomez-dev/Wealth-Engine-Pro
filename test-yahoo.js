import fs from 'fs';

async function testFetch() {
  const symbol = 'VTSAX';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
  };
  
  const resp = await fetch(url, { headers });
  console.log('Status', resp.status);
  const data = await resp.text();
  console.log('Body length:', data.length);
  if (resp.status !== 200) {
    console.log(data);
  }
}

testFetch();
