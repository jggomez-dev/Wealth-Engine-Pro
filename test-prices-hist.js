import fs from 'fs';

async function testFetch() {
  const symbol = 'VTSAX';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`;
  const resp = await fetch(url);
  const data = await resp.json();
  const result = data.chart.result[0];
  const closes = result.indicators.quote[0].close;
  const timestamps = result.timestamp;
  
  for (let i = closes.length - 1; i >= Math.max(0, closes.length - 30); i--) {
     if (Math.abs(closes[i] - 163.31) < 0.5) {
        console.log(`Found a close match: ${closes[i]} on ${new Date(timestamps[i] * 1000).toISOString()}`);
     }
  }
}

testFetch();
