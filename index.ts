import axios, { AxiosError } from 'axios';
import { MutationEvent, Storage } from 'kevast/dist/Storage';

type AxiosInstance = ReturnType<typeof axios.create>;
interface KVMap {
  [key: string]: string | undefined;
}

const DEFAULT_FILENAME = 'kevast-gist-default.json';

export class KevastGist implements Storage {
  private gistId: string;
  private filename: string;
  private cache: KVMap;
  private initialized: boolean;
  private r: AxiosInstance;
  public constructor(token: string, gistId?: string, filename?: string) {
    if (typeof token !== 'string') {
      throw TypeError('Access token must be string.');
    }
    if (gistId !== undefined && typeof gistId !== 'string') {
      throw TypeError('Gist id must be string.');
    }
    if (filename !== undefined && typeof filename !== 'string') {
      throw TypeError('Filename must be string.');
    }
    this.cache = {};
    this.initialized = false;
    this.gistId = gistId || '';
    this.filename = filename || '';
    this.r = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Authorization': `token ${token}`,
        'Cache-Control': 'no-cache, no-store',
      },
    });
  }
  public async get(key: string): Promise<string | undefined> {
    await this.init();
    return this.cache[key];
  }
  public async mutate(event: MutationEvent) {
    await this.init();
    event.set.forEach((pair) => this.cache[pair.key] = pair.value);
    event.removed.forEach((key) => delete this.cache[key]);
    if (event.clear) {
      this.cache = {};
    }
    await this.write();
  }
  public async getGistId(): Promise<string> {
    if (!this.gistId) {
      await this.init();
    }
    return this.gistId;
  }
  public async getFilename(): Promise<string> {
    if (!this.filename) {
      await this.init();
    }
    return this.filename;
  }
  public async init(): Promise<void> {
    if (this.initialized) { return; }
    try {
      if (this.gistId && this.filename) {
        this.cache = await this.read();
      }
      if (!this.gistId) {
        this.filename = this.filename = DEFAULT_FILENAME;
        this.gistId = this.gistId = await this.createGist();
        this.cache = {};
      }
      if (!this.filename) {
        this.filename = DEFAULT_FILENAME;
        await this.createFile();
        this.cache = {};
      }
      this.initialized = true;
    } catch (err) {
      handleError(err);
    }
  }
  private async write(): Promise<void> {
    const payload = {
      files: {
        [this.filename]: {
          content: JSON.stringify(this.cache),
        },
      },
    };
    await this.r.patch(`/gists/${this.gistId}`, payload);
  }
  private async read(): Promise<KVMap> {
    const { data } = await this.r.get(`/gists/${this.gistId}`);
    const file = data.files[this.filename];
    if (!file) {
      // Create a new one owns the filename
      await this.createFile();
      return {};
    } else if (file.size === 0) {
      return {};
    } else {
      let content: string;
      if (file.truncated) {
        const result = (await this.r.get(file.raw_url)).data;
        if (typeof result === 'object') {
          return result;
        } else {
          content = result;
        }
      } else {
        content = file.content;
      }
      try {
        return JSON.parse(content);
      } catch (err) {
        throw new Error('Fail to parse gist content');
      }
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
    await this.r.patch(`/gists/${this.gistId}`, payload);
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
    const { data } = await this.r.post('/gists', payload);
    return data.id;
  }
}

function handleError(err: AxiosError | Error) {
  const error: AxiosError = err as AxiosError;
  if (error.response) {
    if (error.response.status === 401) {
      throw new Error('Invalid access token');
    } else if (error.response.status === 404) {
      const scopes = error.response.headers['x-oauth-scopes'] as string;
      if (!scopes || !scopes.includes('gist')) {
        throw new Error('The OAuth scopes of access token must include "gist"');
      } else if (error.response.data.message === 'Not Found') {
        throw new Error('Gist does not exist or No permission to operate this gist');
      }
    }
  }
  throw error;
}
