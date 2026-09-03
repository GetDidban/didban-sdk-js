import type { DidbanReport } from './types';

export const DIDBAN_API = { reports: '/api/v1/events' } as const;

export interface ApiClientOptions {
  apiKey: string;
  baseUrl: string;
  reportPath?: string;
}

export class DidbanApiClient {
  readonly #apiKey: string;
  readonly #reportUrl: string;
  readonly #fetch: typeof fetch | undefined;

  constructor(options: ApiClientOptions) {
    this.#apiKey = options.apiKey;
    this.#reportUrl = new URL(options.reportPath ?? DIDBAN_API.reports, options.baseUrl).toString();
    this.#fetch =
      typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined;
  }

  get reportUrl(): string {
    return this.#reportUrl;
  }

  async sendReport(report: DidbanReport): Promise<void> {
    if (!this.#fetch) throw new Error('Didban requires fetch() to send reports');
    const response = await this.#fetch(this.#reportUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.#apiKey },
      body: JSON.stringify(report),
    });
    if (!response.ok) throw new Error(`Didban server returned HTTP ${response.status}`);
  }
}
