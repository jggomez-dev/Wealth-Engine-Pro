import fs from 'fs';

async function testFetch() {
  const tickers = ['VTIAX', 'VXUS', 'VEA', 'VTSAX', 'VTTSX', 'FZROX'];
  const url = `http://localhost:3000/api/prices?tickers=${tickers.join(',')}`;
  const resp = await fetch(url);
  const data = await resp.json();
  console.log(JSON.stringify(data, null, 2));
}

testFetch();
