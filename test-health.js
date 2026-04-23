async function fetchHealth() {
  const url = 'https://ais-dev-nuyybfeebhb6dbicqt5xcx-184584188959.europe-west2.run.app/api/health';
  const resp = await fetch(url);
  console.log(resp.status);
  console.log(await resp.text());
}
fetchHealth();
