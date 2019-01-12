const request = require('request-promise');

if (!process.env.TOKEN) {
  throw new Error('Please input TOKEN through environment variables\n');
}

const r = request.defaults({
  baseUrl: 'https://api.github.com',
  json: true,
  headers: {
    'Authorization': `token ${process.env.TOKEN}`,
    'User-Agent': 'KevastGist',
  },
});

(async () => {
  const gists = await r.get('/gists');
  console.log(`${gists.length} gists found`);
  for (const one of gists) {
    await r.delete(`/gists/${one.id}`);
    console.log(`${one.id} deleted`);
  }
  console.log(`${gists.length} gists deleted`);
})();
