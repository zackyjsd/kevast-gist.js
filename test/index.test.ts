import assert = require('assert');
import axios from 'axios';
import { Kevast } from 'kevast';
import { KevastGist } from '../index';

const TOKEN = process.env.TOKEN;
const INVALID_TOKEN = '!@#$%^&*(';
const TOKEN_WITHOUT_GIST_SCOPE = process.env.TOKEN_WITHOUT_GIST_SCOPE;

if (!TOKEN || !TOKEN_WITHOUT_GIST_SCOPE) {
  throw new Error('Please input TOKEN & TOKEN_WITHOUT_GIST_SCOPE through environment variables\n');
}

let gistId: string;
let kevastGist: KevastGist;
let kevast: Kevast;
describe('Test basic function', () => {
  it('Initialization', async () => {
    assert.throws(() => {
      const _ = new KevastGist(1 as any as string);
    }, {
      message: 'Access token must be string.',
    });
    assert.throws(() => {
      const _ = new KevastGist(TOKEN, 1 as any as string);
    }, {
      message: 'Gist id must be string.',
    });
    assert.throws(() => {
      const _ = new KevastGist(TOKEN, 'string', 1 as any as string);
    }, {
      message: 'Filename must be string.',
    });
  });
  it('Valid Access token', async () => {
    kevastGist = new KevastGist(TOKEN);
    kevast = new Kevast(kevastGist);
    await basicTest();
    gistId = await kevastGist.getGistId();
    await deleteGist(gistId);
  });
  it('Invalid access token', async () => {
    await assertThrowsAsync(async () => {
      kevastGist = new KevastGist(INVALID_TOKEN);
      kevast = new Kevast(kevastGist);
      await kevast.get('key');
    }, {
      message: 'Invalid access token',
    });
    await assertThrowsAsync(async () => {
      kevastGist = new KevastGist(TOKEN_WITHOUT_GIST_SCOPE);
      kevast = new Kevast(kevastGist);
      await kevast.get('key');
    }, {
      message: 'The OAuth scopes of access token must include "gist"',
    });
  });
  it('Valid Access token, valid gist id', async () => {
    gistId = await createGist('KevastTestFileName');
    kevastGist = new KevastGist(TOKEN, gistId);
    kevast = new Kevast(kevastGist);
    // await basicTest();
    await kevast.set('key', 'value');
    assert(await readFromGist(gistId, await kevastGist.getFilename()) === JSON.stringify({key: 'value'}));
    await deleteGist(gistId);
  });
  it('Valid access token, invalid gist id', async () => {
    // Not Exists
    await assertThrowsAsync(async () => {
      kevastGist = new KevastGist(TOKEN, '06f031f9faa95f79569f7c76df446e51');
      kevast = new Kevast(kevastGist);
      await kevast.get('key');
    }, {
      message: 'Gist does not exist or No permission to operate this gist',
    });
    // No permission
    await assertThrowsAsync(async () => {
      kevastGist = new KevastGist(TOKEN, '06f031f9faa95f79569f7c76df446e57');
      kevast = new Kevast(kevastGist);
      await kevast.get('key');
    }, {
      message: 'Gist does not exist or No permission to operate this gist',
    });
  });
  it('InValid access token, with any gist id', async () => {
    await assertThrowsAsync(async () => {
      kevastGist = new KevastGist(INVALID_TOKEN, 'anything');
      kevast = new Kevast(kevastGist);
      await kevast.get('key');
    }, {
      message: 'Invalid access token',
    });
    await assertThrowsAsync(async () => {
      kevastGist = new KevastGist(TOKEN_WITHOUT_GIST_SCOPE, 'anything');
      kevast = new Kevast(kevastGist);
      await kevast.get('key');
    }, {
      message: 'The OAuth scopes of access token must include "gist"',
    });
  });
  it('Filename not exists', async () => {
    const existFilename = 'KevastTest';
    const givenFilename = 'KevastTest123';
    gistId = await createGist(existFilename);
    kevastGist = new KevastGist(TOKEN, gistId, givenFilename);
    kevast = new Kevast(kevastGist);
    // await basicTest();
    await kevast.set('key', 'value');
    assert(await readFromGist(gistId, await kevastGist.getFilename()) === JSON.stringify({key: 'value'}));
    await deleteGist(gistId);
  });
  it('Filename exists', async () => {
    const filename = 'KevastTest';
    gistId = await createGist(filename);
    kevastGist = new KevastGist(TOKEN, gistId, filename);
    kevast = new Kevast(kevastGist);
    // await basicTest();
    await kevast.set('key', 'value');
    assert(await readFromGist(gistId, await kevastGist.getFilename()) === JSON.stringify({key: 'value'}));
    await deleteGist(gistId);
  });
  it('Init with data', async () => {
    const filename = 'KevastTest';
    const data = {
      key1: 'value1',
      key2: 'value2',
      key3: 'value3',
    };
    gistId = await createGist(filename, JSON.stringify(data));
    kevastGist = new KevastGist(TOKEN, gistId, filename);
    kevast = new Kevast(kevastGist);
    assert(await kevast.get('key1') === data.key1);
    assert(await kevast.get('key2') === data.key2);
    assert(await kevast.get('key3') === data.key3);
    await deleteGist(gistId);
  });
  it('Truncation Test', async () => {
    const value = '0'.repeat(980000);
    gistId = await createGist('KevastLong', JSON.stringify({key: value}));
    kevastGist = new KevastGist(TOKEN, gistId, 'KevastLong');
    kevast = new Kevast(kevastGist);
    assert(await kevast.get('key') === value);
  });
});

export async function basicTest() {
  // Set
  await kevast.bulkSet([
    {
      key: 'key1',
      value: 'value1',
    },
    {
      key: 'key2',
      value: 'value2',
    },
  ]);
  assert(await kevast.get('key1') === 'value1');
  assert(await kevast.get('key2') === 'value2');
  gistId = gistId || await kevastGist.getGistId();
  const filename = await kevastGist.getFilename();
  assert(await readFromGist(gistId, filename) === JSON.stringify({
    key1: 'value1',
    key2: 'value2',
  }));
  // Delete
  await kevast.remove('key1');
  assert(await kevast.get('key1') === undefined);
  assert(await kevast.get('key2') === 'value2');
  assert(await readFromGist(gistId, filename) === JSON.stringify({
    key2: 'value2',
  }));
  // Clear
  await kevast.clear();
  assert(await kevast.get('key1') === undefined);
  assert(await kevast.get('key2') === undefined);
  assert(await readFromGist(gistId, filename) === JSON.stringify({}));
}

/* tslint:disable: ban-types */
async function assertThrowsAsync(fn: Function, regExp: RegExp | Function | Object | Error) {
  let f = () => {};
  try {
    await fn();
  } catch (e) {
    f = () => {throw e; };
  } finally {
    assert.throws(f, regExp);
  }
}

async function createGist(name: string, content: string = '{}') {
  const { data } = await axios({
    method: 'POST',
    url: 'https://api.github.com/gists',
    data: {
      files: {
        [name]: {
          content,
        },
      },
    },
    headers: {
      'Authorization': `token ${TOKEN}`,
      'User-Agent': 'KevastGist',
    },
  });
  return data.id;
}

async function deleteGist(id: string) {
  return axios({
    method: 'DELETE',
    url: `https://api.github.com/gists/${id}`,
    headers: {
      'Authorization': `token ${TOKEN}`,
      'User-Agent': 'KevastGist',
    },
  });
}

async function readFromGist(id: string, name: string) {
  const { data } = await axios({
    method: 'GET',
    url: `https://api.github.com/gists/${id}`,
    headers: {
      'Authorization': `token ${TOKEN}`,
      'User-Agent': 'KevastGist',
    },
  });
  const file = data.files[name];
  if (file.truncated) {
    return axios({
      method: 'GET',
      url: file.raw_url,
      headers: {
        'Authorization': `token ${TOKEN}`,
        'User-Agent': 'KevastGist',
      },
    });
  } else {
    return file.content;
  }
}
