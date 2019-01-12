import * as request from 'request';
import * as requestPromise from 'request-promise';
import { RequestError } from 'request-promise/errors';
import { MutationEvent, Storage } from 'kevast/dist/Storage';
import { read } from 'fs';

type RequestInstance = request.RequestAPI<
  requestPromise.RequestPromise,
  requestPromise.RequestPromiseOptions,
  request.RequiredUriUrl
>;
interface KVMap {
  [key: string]: string | undefined;
}

const DEFAULT_FILENAME = 'kevast-gist-default.json';

export class KevastGist implements Storage {
  public static async create(token: string, gistId?: string, filename?: string): Promise<KevastGist> {
    if (typeof token !== 'string') {
      throw TypeError('Access token must be string.');
    }
    if (gistId !== undefined && typeof gistId !== 'string') {
      throw TypeError('Gist id must be string.');
    }
    if (filename !== undefined && typeof filename !== 'string') {
      throw TypeError('Filename must be string.');
    }
    const that: KevastGist = new KevastGist(token, gistId, filename);
    try {
      if (typeof gistId === 'string' && typeof filename === 'string') {
        await that.read();
      }
      if (gistId === undefined) {
        that.filename = filename = DEFAULT_FILENAME;
        that.gistId = gistId = await that.createGist();
      }
      if (filename === undefined) {
        that.filename = DEFAULT_FILENAME;
        await that.createFile();
      }
    } catch (err) {
      handleError(err);
    }
    return that;
  }
  private gistId: string;
  private filename: string;
  private cache: KVMap;
  private r: RequestInstance;
  private constructor(token: string, gistId?: string, filename?: string) {
    this.cache = {};
    this.gistId = gistId || '';
    this.filename = filename || '';
    this.r = requestPromise.defaults({
      baseUrl: 'https://api.github.com',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'KevastGist',
      },
      json: true,
    });
  }
  public get(key: string): string | undefined {
    return this.cache[key];
  }
  public async mutate(event: MutationEvent) {
    event.set.forEach((pair) => (this.cache as KVMap)[pair.key] = pair.value);
    event.removed.forEach((key) => delete (this.cache as KVMap)[key]);
    if (event.clear) {
      this.cache = {};
    }
    await this.write();
  }
  public getGistId(): string {
    return this.gistId;
  }
  public getFilename(): string {
    return this.filename;
  }
  private async write(): Promise<void> {
    const payload = {
      files: {
        [this.filename]: {
          content: JSON.stringify(this.cache),
        },
      },
    };
    await this.r.patch({
      uri: `/gists/${this.gistId}`,
      json: payload,
    });
  }
  private async read(): Promise<void> {
    const data = await this.r.get(`/gists/${this.gistId}`);
    const file = data.files[this.filename];
    if (!file) {
      // Create a new one owns the filename
      await this.createFile();
    } else if (file.size > 0) {
      let complete: string;
      if (file.truncated) {
        complete = await requestPromise.get(file.raw_url);
      } else {
        complete = file.content;
      }
      this.cache = JSON.parse(complete);
    }
  }
  private async createFile(): Promise<void> {
    const payload = {
      files: {
        [this.filename]: {
          content: '{}',
        },
      },
    };
    await this.r.patch({
      uri: `/gists/${this.gistId}`,
      json: payload,
    });
  }
  private async createGist(): Promise<string> {
    const payload = {
      description: 'This file is used by KevastGist.',
      public: false,
      files: {
        [this.filename]: {
          content: '{}',
        },
      },
    };
    const data = await this.r.post({
      uri: '/gists',
      json: payload,
    });
    return data.id;
  }
}

function handleError(err: RequestError | Error) {
  const error: RequestError = err as RequestError;
  if (error.response) {
    if (error.response.statusCode === 401) {
      throw new Error('Invalid access token');
    } else if (error.response.statusCode === 404) {
      const scopes = error.response.headers['x-oauth-scopes'] as string;
      if (!scopes || !scopes.includes('gist')) {
        throw new Error('The OAuth scopes of access token must include "gist"');
      } else if (error.message.startsWith('404 - {"message":"Not Found')) {
        throw new Error('Gist does not exist or No permission to operate this gist');
      }
    }
  }
  throw error;
}
