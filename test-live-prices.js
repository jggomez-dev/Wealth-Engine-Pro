import fs from 'fs';

async function testFetch() {
  const url = `https://ais-dev-nuyybfeebhb6dbicqt5xcx-184584188959.europe-west2.run.app/api/prices?tickers=VTSAX,VTIAX&clearCache=true`;
  console.log('Fetching from:', url);
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

testFetch();
