import axios from 'axios';
import { IMutationEvent, IStorage } from 'kevast/dist/Storage';

const DEFAULT_FILENAME = 'KevastGist';

export class KevastGist implements IStorage {
  private gistId: string;
  private filename: string;
  private r: ReturnType<typeof axios.create>;
  public constructor(token: string, gistId?: string, filename?: string) {
    if (typeof token !== 'string') {
      throw TypeError('Access token must be string.');
    }
    if (gistId !== undefined && gistId !== null && typeof gistId !== 'string') {
      throw TypeError('Gist id must be string.');
    }
    if (filename !== undefined && filename !== null && typeof filename !== 'string') {
      throw TypeError('Filename must be string.');
    }
    this.gistId = gistId;
    this.filename = filename;
    this.r = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        Authorization: `token ${token}`,
      },
    });
  }
  public async current(): Promise<Map<string, string>> {
    return this.pull();
  }
  public async mutate(event: IMutationEvent) {
    await this.push(event.current);
  }
  public getGistId(): string {
    return this.gistId;
  }
  public getFilename(): string {
    return this.filename;
  }
  private async push(data: Map<string, string>): Promise<void> {
    const payload = {
      files: {
        [this.filename || DEFAULT_FILENAME]: {
          content: JSON.stringify([...data]),
        },
      },
    };
    if (this.gistId) {
      await this.r.patch(`/gists/${this.gistId}`, payload);
    } else {
      const res = await this.r.post(`/gists`, payload);
      this.gistId = res.data.id;
      this.filename = DEFAULT_FILENAME;
    }
  }
  private async pull(): Promise<Map<string, string>> {
    if (!this.gistId) {
      return Promise.resolve(new Map());
    }
    const { data } = await this.r.get(`/gists/${this.gistId}`);
    if (!data.files[this.filename]) { return Promise.resolve(new Map()); }
    if (data.files[this.filename].size === 0) { return Promise.resolve(new Map()); }
    if (data.files[this.filename].truncated) {
      const res = await this.r.get(data.files[this.filename].raw_url);
      return Promise.resolve(new Map(JSON.parse(res.data)));
    } else {
      return Promise.resolve(new Map(JSON.parse(data.files[this.filename].content)));
    }
  }
}
