import assert = require('assert');
import * as request from 'request-promise';
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
    await assertThrowsAsync(async () => {
      await KevastGist.create(1 as any as string);
    }, {
      message: 'Access token must be string.',
    });
    await assertThrowsAsync(async () => {
      await KevastGist.create(TOKEN, 1 as any as string);
    }, {
      message: 'Gist id must be string.',
    });
    await assertThrowsAsync(async () => {
      await KevastGist.create(TOKEN, 'string', 1 as any as string);
    }, {
      message: 'Filename must be string.',
    });
  });
  it('Valid Access token', async () => {
    const kg = await KevastGist.create(TOKEN);
    kevastGist = kg;
    kevast = new Kevast(kevastGist);
    gistId = kevastGist.getGistId();
    await basicTest();
    await deleteGist(gistId);
  });
  it('Invalid access token', async () => {
    await assertThrowsAsync(async () => {
      await KevastGist.create(INVALID_TOKEN);
    }, {
      message: 'Invalid access token',
    });
    await assertThrowsAsync(async () => {
      await KevastGist.create(TOKEN_WITHOUT_GIST_SCOPE);
    }, {
      message: 'The OAuth scopes of access token must include "gist"',
    });
  });
  it('Valid Access token, valid gist id', async () => {
    gistId = await createGist('KevastTestFileName');
    kevastGist = await KevastGist.create(TOKEN, gistId);
    kevast = new Kevast(kevastGist);
    await basicTest();
    await deleteGist(gistId);
  });
  it('Valid access token, invalid gist id', async () => {
    await assertThrowsAsync(async () => {
      await KevastGist.create(TOKEN, '06f031f9faa95f79569f7c76df446e51');
    }, {
      message: 'Gist does not exist or No permission to operate this gist',
    });
    await assertThrowsAsync(async () => {
      await KevastGist.create(TOKEN, '06f031f9faa95f79569f7c76df446e57');
    }, {
      message: 'Gist does not exist or No permission to operate this gist',
    });
  });
  it('InValid access token, with any gist id', async () => {
    await assertThrowsAsync(async () => {
      await KevastGist.create(INVALID_TOKEN, 'anything');
    }, {
      message: 'Invalid access token',
    });
    await assertThrowsAsync(async () => {
      await KevastGist.create(TOKEN_WITHOUT_GIST_SCOPE, 'anything');
    }, {
      message: 'The OAuth scopes of access token must include "gist"',
    });
  });
  it('Filename not exists', async () => {
    const existFilename = 'KevastTest';
    const givenFilename = 'KevastTest123';
    gistId = await createGist(existFilename);
    kevastGist = await KevastGist.create(TOKEN, gistId, givenFilename);
    kevast = new Kevast(kevastGist);
    await basicTest();
    await deleteGist(gistId);
  });
  it('Filename exists', async () => {
    const filename = 'KevastTest';
    gistId = await createGist(filename);
    kevastGist = await KevastGist.create(TOKEN, gistId, filename);
    kevast = new Kevast(kevastGist);
    await basicTest();
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
    kevastGist = await KevastGist.create(TOKEN, gistId, filename);
    kevast = new Kevast(kevastGist);
    assert(await kevast.get('key1') === data.key1);
    assert(await kevast.get('key2') === data.key2);
    assert(await kevast.get('key3') === data.key3);
    await deleteGist(gistId);
  });
  it('Truncation Test', async () => {
    const value = '0'.repeat(980000);
    gistId = await createGist('KevastLong', JSON.stringify({key: value}));
    kevastGist = await KevastGist.create(TOKEN, gistId, 'KevastLong');
    kevast = new Kevast(kevastGist);
    assert(await kevast.get('key') === value);
  });
});

export async function basicTest() {
  // Set
  await kevast.set('key1', 'value1');
  await kevast.set('key2', 'value2');
  assert(await kevast.get('key1') === 'value1');
  assert(await kevast.get('key2') === 'value2');
  gistId = gistId || kevastGist.getGistId();
  const filename = kevastGist.getFilename();
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
  const data = await request.post({
    uri: 'https://api.github.com/gists',
    json: {
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
  return request.delete({
    uri: `https://api.github.com/gists/${id}`,
    headers: {
      'Authorization': `token ${TOKEN}`,
      'User-Agent': 'KevastGist',
    },
  });
}

async function readFromGist(id: string, name: string) {
  const data = await request.get({
    uri: `https://api.github.com/gists/${id}`,
    headers: {
      'Authorization': `token ${TOKEN}`,
      'User-Agent': 'KevastGist',
    },
    json: true,
  });
  const file = data.files[name];
  if (file.truncated) {
    return request.get({
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
