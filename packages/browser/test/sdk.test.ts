import { afterEach, describe, expect, it, vi } from 'vitest';
import { Didban } from '../src/didban';

afterEach(() => {
  Didban.destroy();
  document.body.innerHTML = '';
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('Didban browser SDK', () => {
  it('requires a non-empty appName', () => {
    expect(() => Didban.init({ apiKey: 'test', appName: '' })).toThrow(
      'Didban.init requires a non-empty appName',
    );
  });

  it('captures clicks and masks password input', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 202 })),
    );
    document.body.innerHTML =
      '<button id="save">Save</button><input id="password" type="password">';
    Didban.init({ apiKey: 'test', appName: 'checkout-web', config: { captureNetwork: false } });

    document.querySelector('button')?.click();
    const input = document.querySelector('input') as HTMLInputElement;
    input.value = 'top-secret';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const breadcrumbs = Didban.getBreadcrumbs();
    expect(breadcrumbs.map((item) => item.category)).toEqual(['user.click', 'user.input']);
    expect(breadcrumbs[1]?.data?.value).toBe('[Masked]');
  });

  it('sends a sanitized browser report', async () => {
    const send = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 202 }),
    );
    vi.stubGlobal('fetch', send);
    Didban.init({
      apiKey: 'test-key',
      appName: 'storefront-web',
      config: { baseUrl: 'https://collector.example', captureNetwork: false },
    });
    Didban.userData = { id: '42', apiKey: 'must-not-leak' };
    Didban.addClue('checkout', { token: 'hidden', plan: 'pro' });

    expect(await Didban.capture(new Error('boom'))).toBe(true);
    const [url, options] = send.mock.calls[0]!;
    const report = JSON.parse(String(options?.body));
    expect(url).toBe('https://collector.example/api/v1/events');
    expect(report.appName).toBe('storefront-web');
    expect(report.user.apiKey).toBe('[Filtered]');
    expect(report.sdk.name).toBe('@didban/browser-sdk');
    expect((await Didban.getStoredErrors())[0]).toMatchObject({
      appName: 'storefront-web',
      error: { message: 'boom' },
    });
  });

  it('captures failed fetch details and reports the HTTP error', async () => {
    const original = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('collector.example')) return new Response(null, { status: 202 });
      return new Response(JSON.stringify({ reason: 'denied' }), { status: 403 });
    });
    vi.stubGlobal('fetch', original);
    Didban.init({
      apiKey: 'test',
      appName: 'checkout-web',
      config: { baseUrl: 'https://collector.example' },
    });

    async function submitOrder(): Promise<Response> {
      return fetch('https://service.example/orders', {
        method: 'POST',
        body: JSON.stringify({ product: 10, token: 'must-not-leak' }),
      });
    }

    const response = await submitOrder();
    await vi.waitFor(() => expect(original).toHaveBeenCalledTimes(2));

    expect(response.status).toBe(403);
    const http = Didban.getBreadcrumbs().find((item) => item.category === 'http');
    expect(http?.data).toMatchObject({
      status: 403,
      method: 'POST',
      responseBody: { reason: 'denied' },
      requestBody: { product: 10, token: '[Filtered]' },
    });
    const reportCall = original.mock.calls.find(([input]) =>
      String(input).includes('collector.example'),
    );
    const report = JSON.parse(String(reportCall?.[1]?.body));
    expect(report.error.stack).toContain('submitOrder');
    expect(report.error.stack).toContain('returned HTTP 403');
  });
});
