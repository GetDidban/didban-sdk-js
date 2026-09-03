import { afterEach, describe, expect, it, vi } from 'vitest';
import { Didban } from '../src/didban';

afterEach(() => {
  Didban.destroy();
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
});
