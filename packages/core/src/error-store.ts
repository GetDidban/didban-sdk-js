import type { DidbanReport } from './types';

export const ERROR_RETENTION_MS = 3 * 24 * 60 * 60 * 1_000;
export const MAX_STORED_ERRORS = 20;

export interface KeyValueStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export class ErrorReportStore {
  readonly #storage: KeyValueStorage;
  readonly #key: string;
  #pending: Promise<unknown> = Promise.resolve();

  constructor(storage: KeyValueStorage, appName: string) {
    this.#storage = storage;
    this.#key = `didban:errors:v1:${encodeURIComponent(appName)}`;
  }

  add(report: DidbanReport): Promise<void> {
    return this.#enqueue(async () => {
      const reports = await this.#read(Date.now());
      reports.push(report);
      await this.#write(reports.slice(-MAX_STORED_ERRORS));
    });
  }

  list(): Promise<DidbanReport[]> {
    return this.#enqueue(async () => {
      const reports = await this.#read(Date.now());
      await this.#write(reports);
      return reports;
    });
  }

  clear(): Promise<void> {
    return this.#enqueue(async () => {
      await this.#storage.removeItem(this.#key);
    });
  }

  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#pending.then(operation, operation);
    this.#pending = result.catch(() => undefined);
    return result;
  }

  async #read(now: number): Promise<DidbanReport[]> {
    const raw = await this.#storage.getItem(this.#key);
    if (!raw) return [];

    try {
      const value: unknown = JSON.parse(raw);
      if (!Array.isArray(value)) return [];
      const cutoff = now - ERROR_RETENTION_MS;
      return value
        .filter(isDidbanReport)
        .filter((report) => {
          const timestamp = Date.parse(report.timestamp);
          return Number.isFinite(timestamp) && timestamp >= cutoff;
        })
        .slice(-MAX_STORED_ERRORS);
    } catch {
      return [];
    }
  }

  async #write(reports: DidbanReport[]): Promise<void> {
    if (reports.length === 0) {
      await this.#storage.removeItem(this.#key);
      return;
    }
    await this.#storage.setItem(this.#key, JSON.stringify(reports));
  }
}

function isDidbanReport(value: unknown): value is DidbanReport {
  if (!value || typeof value !== 'object') return false;
  const report = value as Partial<DidbanReport>;
  return (
    typeof report.eventId === 'string' &&
    typeof report.appName === 'string' &&
    typeof report.timestamp === 'string' &&
    Boolean(report.error) &&
    typeof report.error?.message === 'string'
  );
}
