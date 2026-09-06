import { afterEach, describe, expect, it, vi } from 'vitest';
import { Didban } from '../src/didban';
import AsyncStorage from '@react-native-async-storage/async-storage';

afterEach(() => {
  Didban.destroy();
  void AsyncStorage.clear();
  vi.unstubAllGlobals();
});

describe('Didban React Native SDK', () => {
  it('adds navigation breadcrumbs and React Native device context', async () => {
    const send = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', send);
    Didban.init({
      apiKey: 'test-key',
      appName: 'mobile-app',
      config: {
        baseUrl: 'https://collector.example',
        captureAppErrors: false,
        captureUnhandledRejections: false,
        captureNetwork: false,
      },
    });

    Didban.setCurrentRoute('Checkout', { cartId: 'cart-8' });
    expect(await Didban.capture(new Error('payment failed'))).toBe(true);

    const report = JSON.parse(String(send.mock.calls[0]?.[1]?.body));
    expect(report.page.route).toBe('Checkout');
    expect(report.device).toMatchObject({
      platform: 'ios',
      osVersion: '18.0',
      viewport: { width: 390, height: 844 },
    });
    expect(report.sdk.name).toBe('@didban/react-native');
    expect(report.breadcrumbs[0]).toMatchObject({
      category: 'navigation',
      data: { to: 'Checkout', params: { cartId: 'cart-8' } },
    });
    expect((await Didban.getStoredErrors())[0]?.error.message).toBe('payment failed');
  });

  it('captures React Native global errors and preserves the previous handler', () => {
    const previous = vi.fn();
    let handler = previous;
    const errorUtils = {
      getGlobalHandler: () => handler,
      setGlobalHandler: (next: typeof handler) => {
        handler = next;
      },
    };
    vi.stubGlobal('ErrorUtils', errorUtils);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 202 })),
    );

    Didban.init({
      apiKey: 'test',
      appName: 'mobile-app',
      config: { captureNetwork: false, captureUnhandledRejections: false },
    });
    handler(new Error('native runtime error'), true);

    expect(Didban.getBreadcrumbs()[0]?.message).toBe('native runtime error');
    expect(previous).toHaveBeenCalledWith(expect.any(Error), true);
    Didban.destroy();
    expect(handler).toBe(previous);
  });

  it('keeps the application call site when reporting failed HTTP responses', async () => {
    const send = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('collector.example')) return new Response(null, { status: 202 });
      return new Response(JSON.stringify({ reason: 'denied' }), { status: 403 });
    });
    vi.stubGlobal('fetch', send);
    Didban.init({
      apiKey: 'test-key',
      appName: 'mobile-app',
      config: {
        baseUrl: 'https://collector.example',
        captureAppErrors: false,
        captureUnhandledRejections: false,
      },
    });

    async function loadOrders(): Promise<Response> {
      return fetch('https://service.example/orders');
    }

    const response = await loadOrders();
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));

    expect(response.status).toBe(403);
    const reportCall = send.mock.calls.find(([input]) =>
      String(input).includes('collector.example'),
    );
    const report = JSON.parse(String(reportCall?.[1]?.body));
    expect(report.error.stack).toContain('loadOrders');
    expect(report.error.stack).toContain('returned HTTP 403');
  });

  it('sends a warning report when the current screen drops FPS', async () => {
    let nextFrame: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      nextFrame = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const send = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', send);
    Didban.init({
      apiKey: 'test-key',
      appName: 'mobile-app',
      config: {
        baseUrl: 'https://collector.example',
        captureAppErrors: false,
        captureUnhandledRejections: false,
        captureNetwork: false,
        fpsSampleWindowMs: 1_000,
        fpsReportCooldownMs: 0,
      },
    });
    Didban.setCurrentRoute('ProductList');

    for (let timestamp = 0; timestamp <= 1_040; timestamp += 40) nextFrame!(timestamp);
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());

    const report = JSON.parse(String(send.mock.calls[0]?.[1]?.body));
    expect(report.context).toMatchObject({
      level: 'warning',
      tags: { type: 'performance', route: 'ProductList' },
      extra: {
        performance: {
          route: 'ProductList',
          averageFps: 25,
          slowFramePercentage: 100,
        },
      },
    });
  });
});
