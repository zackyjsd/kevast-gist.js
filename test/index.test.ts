import assert = require('assert');
import axios from 'axios';
import { Kevast } from 'kevast';
import { KevastGist } from '../index';
import { basicTest } from './share';

const TOKEN = process.env.TOKEN;
const INVALID_TOKEN = '10086';
const TOKEN_WITHOUT_GIST_SCOPE = process.env.TOKEN_WITHOUT_GIST_SCOPE;

if (!TOKEN || !TOKEN_WITHOUT_GIST_SCOPE) {
  process.stderr.write('Please input TOKEN & TOKEN_WITHOUT_GIST_SCOPE through environment variables\n');
  process.exit(1);
}

describe('Test basic function', () => {
  before(() => {
    this.token = TOKEN;
  });
  it('Valid Access token', async () => {
    const kevastGist = new KevastGist(TOKEN);
    this.kevastGist = kevastGist;
    this.kevast = await Kevast.create(kevastGist);
    this.gistId = kevastGist.getGistId();
    this.filename = kevastGist.getFilename();
    await basicTest.call(this);
    await deleteGist(this.token, this.gistId);
  });
  it('Invalid access token', async () => {
    try {
      const kevastGist = new KevastGist(INVALID_TOKEN);
    } catch (err) {
      assert(err.message === 'Invalid access token');
    }
    try {
      const kevastGist = new KevastGist(TOKEN_WITHOUT_GIST_SCOPE);
    } catch (err) {
      assert(err.message === 'The OAuth scopes of access token must include "gist"');
    }
  });
  it('Valid Access token, valid gist id', async () => {
    this.gistId = await createGist(this.token, 'KevastTest');
    const kevastGist = new KevastGist(TOKEN, this.gistId);
    this.filename = kevastGist.getFilename();
    this.kevast = await Kevast.create(kevastGist);
    await basicTest.call(this);
    await deleteGist(this.token, this.gistId);
  });
  it('Valid access token, invalid gist id', async () => {
    try {
      const kevastGist = new KevastGist(TOKEN, '$%^&*^&WE%&');
    } catch (err) {
      assert(err.message === 'Gist not exists or No permission to operate this gist');
    }
    try {
      const kevastGist = new KevastGist(TOKEN, '0d7733949274a94e73103b85de0bf1af');
    } catch (err) {
      assert(err.message === 'Gist not exists or No permission to operate this gist');
    }
  });
  it('InValid access token, with any gist id', async () => {
    try {
      const kevastGist = new KevastGist(INVALID_TOKEN, 'anything');
    } catch (err) {
      assert(err.message === 'Invalid access token');
    }
    try {
      const kevastGist = new KevastGist(TOKEN_WITHOUT_GIST_SCOPE, 'anything');
    } catch (err) {
      assert(err.message === 'The OAuth scopes of access token must include "gist"');
    }
  });
  it('Filename not exists', async () => {
    const existFilename = 'KevastTest';
    const givenFilename = 'KevastTest123';
    this.gistId = await createGist(this.token, existFilename);
    const kevastGist = new KevastGist(TOKEN, this.gistId, givenFilename);
    this.filename = givenFilename;
    this.kevast = await Kevast.create(kevastGist);
    await basicTest.call(this);
    await deleteGist(this.token, this.gistId);
  });
  it('Filename exists', async () => {
    this.filename = 'KevastTest';
    this.gistId = await createGist(this.token, this.filename);
    const kevastGist = new KevastGist(TOKEN, this.gistId, this.filename);
    this.kevast = await Kevast.create(kevastGist);
    await basicTest.call(this);
    await deleteGist(this.token, this.gistId);
  });
  it('Init with data', async () => {
    this.filename = 'KevastTest';
    const data = [
      ['key1', 'value1'],
      ['key2', 'value2'],
      ['key3', 'value3'],
    ];
    this.gistId = await createGist(this.token, this.filename, JSON.stringify(data));
    this.kevast = await Kevast.create(new KevastGist(this.token, this.gistId, this.filename));
    assert(this.kevast.size() === data.length);
    assert.deepStrictEqual([...this.kevast.entries()], data);
    await deleteGist(this.token, this.gistId);
  });
});

async function createGist(token: string, filename: string, content: string = '[]') {
  const res = await axios.post('https://api.github.com/gists', {
    files: {
      [filename]: {
        content,
      },
    },
  }, {
    headers: {
      Authorization: `token ${token}`,
    },
  });
  return res.data.id;
}

async function deleteGist(token: string, gistId: string) {
  return axios.delete(`https://api.github.com/gists/${gistId}`, {
    headers: {
      Authorization: `token ${token}`,
    },
  });
}
