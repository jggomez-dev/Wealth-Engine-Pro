import fs from 'fs';

async function testFetch() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/VTSAX?interval=1d&range=5d`;
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
  
  const resp = await fetch(url, { headers });
  if (resp.ok) {
    const data = await resp.json();
    console.log(JSON.stringify(data.chart.result[0].meta, null, 2));
    
    const closes = data.chart.result[0].indicators.quote[0].close;
    console.log('Closes array:', closes);
  } else {
    console.log(resp.status);
  }
}

testFetch();
