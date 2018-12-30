import assert = require('assert');
import axios from 'axios';

export async function basicTest() {
  // Set
  await this.kevast.set('key1', 'value1');
  await this.kevast.set('key2', 'value2');
  this.gistId = this.gistId || this.kevastGist.getGistId();
  this.filename = this.filename || this.kevastGist.getFilename();
  assert(await readFromGist(this.token, this.gistId, this.filename) === JSON.stringify([
    ['key1', 'value1'],
    ['key2', 'value2'],
  ]));
  // Delete
  await this.kevast.delete('key1');
  assert(await readFromGist(this.token, this.gistId, this.filename) === JSON.stringify([
    ['key2', 'value2'],
  ]));
  // Clear
  await this.kevast.clear();
  assert(await readFromGist(this.token, this.gistId, this.filename) === JSON.stringify([]));
}

async function readFromGist(token: string, gistId: string, filename: string) {
  const { data } = await axios.get(`https://api.github.com/gists/${gistId}`, {
    headers: {
      Authorization: `token ${token}`,
    },
  });
  if (data.files[filename].truncated) {
    return axios.get(data.files[filename].raw_url, {
      headers: {
        Authorization: `token ${token}`,
      },
    });
  } else {
    return data.files[filename].content;
  }
}
