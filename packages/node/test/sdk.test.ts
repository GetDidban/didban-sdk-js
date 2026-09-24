import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DidbanNodeClient } from '../src/client';

function createClient(config: Record<string, unknown> = {}) {
  const reports: Array<Record<string, any>> = [];
  const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.body) reports.push(JSON.parse(String(init.body)));
    return new Response(null, { status: 202 });
  });
  vi.stubGlobal('fetch', fetchMock);
  const client = new DidbanNodeClient({
    apiKey: 'test-key',
    appName: 'node-test',
    config: {
      baseUrl: 'https://collector.example',
      captureFetch: false,
      monitorEventLoop: false,
      captureUncaughtErrors: false,
      captureUnhandledRejections: false,
      ...config,
    },
  }).start();
  return { client, reports };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('@didban/node-sdk', () => {
  it('captures custom exceptions with active trace metadata', async () => {
    const { client, reports } = createClient();
    await client.trace('checkout', async (span) => {
      span.setAttribute('orderId', 'ord-1');
      await client.captureException(new Error('payment failed'));
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.error.message).toBe('payment failed');
    expect(reports[0]?.context.extra.trace.name).toBe('checkout');
    expect(reports[0]?.context.extra.trace.traceId).toBeTruthy();
    client.destroy();
  });

  it('reports a slow traced operation', async () => {
    const { client, reports } = createClient({ slowOperationThresholdMs: 0 });
    client.trace('expensive-query', () => 42);

    await vi.waitFor(() => expect(reports).toHaveLength(1));
    expect(reports[0]?.error.name).toBe('SlowOperationError');
    expect(reports[0]?.context.tags.operation).toBe('expensive-query');
    expect(reports[0]?.context.extra.trace.durationMs).toBeGreaterThanOrEqual(0);
    client.destroy();
  });

  it('captures thrown trace errors and rethrows them', async () => {
    const { client, reports } = createClient();
    const failure = new Error('database offline');

    expect(() =>
      client.trace('database', () => {
        throw failure;
      }),
    ).toThrow(failure);
    await vi.waitFor(() => expect(reports).toHaveLength(1));
    expect(reports[0]?.context.extra.source).toBe('trace');
    client.destroy();
  });

  it('adds request data through framework-agnostic middleware', async () => {
    const { client, reports } = createClient();
    const response = new EventEmitter() as EventEmitter & { statusCode: number };
    response.statusCode = 200;
    const handler = client.requestHandler({ slowThresholdMs: 10_000 });

    await new Promise<void>((resolve) => {
      handler(
        { method: 'POST', url: '/orders?draft=1', headers: { authorization: 'hidden' } },
        response,
        () => {
          void client.captureMessage('request note').then(() => {
            response.emit('finish');
            resolve();
          });
        },
      );
    });

    expect(reports[0]?.page.route).toBe('/orders');
    expect(reports[0]?.context.extra.request.method).toBe('POST');
    expect(reports[0]?.context.extra.request.headers).toBeUndefined();
    client.destroy();
  });
});
