import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BreadcrumbBuffer,
  DidbanApiClient,
  DidbanCoreClient,
  ERROR_RETENTION_MS,
  ErrorReportStore,
  MAX_STORED_ERRORS,
  resolveCoreConfig,
  sanitize,
  type DidbanReport,
  type KeyValueStorage,
} from '../src';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Didban core', () => {
  it('keeps only the latest 30 breadcrumbs', () => {
    const buffer = new BreadcrumbBuffer(100);
    for (let index = 0; index < 35; index += 1) {
      buffer.add({
        id: String(index),
        category: 'custom',
        message: `item-${index}`,
        timestamp: new Date().toISOString(),
        level: 'info',
      });
    }
    expect(buffer.size).toBe(30);
    expect(buffer.snapshot()[0]?.message).toBe('item-5');
  });

  it('sanitizes secrets and circular values in every platform', () => {
    const value: Record<string, unknown> = { token: 'secret', profile: { name: 'Ada' } };
    value.self = value;
    expect(sanitize(value, 2_000)).toEqual({
      token: '[Filtered]',
      profile: { name: 'Ada' },
      self: '[Circular]',
    });
  });

  it('keeps only the latest 20 errors from the last three days', async () => {
    const values = new Map<string, string>();
    const storage: KeyValueStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
    };
    const store = new ErrorReportStore(storage, 'test-app');
    const now = Date.now();

    await store.add(report('expired', now - ERROR_RETENTION_MS - 1));
    for (let index = 0; index < MAX_STORED_ERRORS + 5; index += 1) {
      await store.add(report(`recent-${index}`, now - index));
    }

    const reports = await store.list();
    expect(reports).toHaveLength(MAX_STORED_ERRORS);
    expect(reports.some((item) => item.error.message === 'expired')).toBe(false);
    expect(reports[0]?.error.message).toBe('recent-5');
    expect(reports.at(-1)?.error.message).toBe('recent-24');
  });

  it('turns collector HTTP and network failures into a false result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    const api = new DidbanApiClient({ apiKey: 'test', baseUrl: 'https://collector.example' });

    await expect(api.sendReport(report('bad-request', Date.now()))).resolves.toBe(false);

    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    await expect(api.sendReport(report('offline', Date.now()))).resolves.toBe(false);
  });

  it('never rejects capture even when user hooks throw', async () => {
    const client = new DidbanCoreClient({
      apiKey: 'test',
      appName: 'test-app',
      config: resolveCoreConfig({
        beforeSend: () => {
          throw new Error('hook failed');
        },
        onError: () => {
          throw new Error('error callback failed');
        },
      }),
      sdk: { name: 'test', version: '1' },
    });

    await expect(client.capture(new Error('application failed'))).resolves.toBe(false);
  });
});

function report(message: string, timestamp: number): DidbanReport {
  return {
    eventId: message,
    appName: 'test-app',
    timestamp: new Date(timestamp).toISOString(),
    error: { name: 'Error', message },
    breadcrumbs: [],
    page: {},
    device: {},
    sdk: { name: 'test', version: '1' },
  };
}
