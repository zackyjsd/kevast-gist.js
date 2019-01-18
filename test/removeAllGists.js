const axios = require('axios');

if (!process.env.TOKEN) {
  throw new Error('Please input TOKEN through environment variables\n');
}

const r = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    'Authorization': `token ${process.env.TOKEN}`,
  },
});

(async () => {
  const { data: gists } = await r.get('/gists');
  console.log(`${gists.length} gists found`);
  for (const one of gists) {
    await r.delete(`/gists/${one.id}`);
    console.log(`${one.id} deleted`);
  }
  console.log(`${gists.length} gists deleted`);
})();
