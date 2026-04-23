import fs from 'fs';

async function testFetch() {
  const symbol = 'VTSAX';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
  const resp = await fetch(url);
  const data = await resp.json();
  const result = data.chart.result[0];
  console.log('meta regularMarketPrice:', result.meta.regularMarketPrice);
  console.log('meta previousClose:', result.meta.previousClose);
  console.log('timestamps:', result.timestamp?.map(t => new Date(t * 1000).toISOString()));
  console.log('closes:', result.indicators.quote[0].close);
}

testFetch();
