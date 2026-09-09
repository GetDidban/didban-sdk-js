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

  it('captures Error objects logged by React error boundaries without double reporting', async () => {
    const send = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 202 }),
    );
    vi.stubGlobal('fetch', send);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const spiedConsoleError = console.error;
    Didban.init({
      apiKey: 'test',
      appName: 'react-web',
      config: { baseUrl: 'https://collector.example', captureNetwork: false },
    });

    const error = new TypeError("Cannot read properties of undefined (reading 'id')");
    console.error('The above error occurred in a component:', error);
    window.dispatchEvent(new ErrorEvent('error', { error, message: error.message }));

    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    const report = JSON.parse(String(send.mock.calls[0]?.[1]?.body));
    expect(report.error).toMatchObject({ name: 'TypeError', message: error.message });
    expect(report.context.extra.source).toBe('console.error');
    expect(consoleSpy).toHaveBeenCalledWith('The above error occurred in a component:', error);

    Didban.destroy();
    expect(console.error).toBe(spiedConsoleError);
  });

  it('reports slow browser requests as configurable warnings', async () => {
    const send = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('collector.example')) return new Response(null, { status: 202 });
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal('fetch', send);
    Didban.init({
      apiKey: 'test',
      appName: 'browser-app',
      config: {
        baseUrl: 'https://collector.example',
        slowRequestThresholdMs: 1,
      },
    });

    await fetch('https://service.example/slow-orders');
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));

    const reportCall = send.mock.calls.find(([input]) =>
      String(input).includes('collector.example'),
    );
    const report = JSON.parse(String(reportCall?.[1]?.body));
    expect(report.error).toMatchObject({
      name: 'SlowHttpRequestError',
      message: 'Slow HTTP request: GET https://service.example/slow-orders',
    });
    expect(report.context).toMatchObject({
      level: 'warning',
      tags: { type: 'performance', operation: 'http' },
      extra: {
        http: {
          url: 'https://service.example/slow-orders',
          slowRequestThresholdMs: 1,
        },
      },
    });
    expect(report.context.extra.http.durationMs).toBeGreaterThan(1);
  });

  it('can disable slow browser request reports', async () => {
    const send = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal('fetch', send);
    Didban.init({
      apiKey: 'test',
      appName: 'browser-app',
      config: {
        baseUrl: 'https://collector.example',
        reportSlowRequests: false,
        slowRequestThresholdMs: 1,
      },
    });

    await fetch('https://service.example/slow-orders');

    expect(send).toHaveBeenCalledOnce();
    expect(Didban.getBreadcrumbs().at(-1)).toMatchObject({
      category: 'http',
      level: 'warning',
    });
  });

  it('does not report an Axios rejection after its failed request was already reported', async () => {
    const send = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('collector.example')) return new Response(null, { status: 202 });
      return new Response(null, { status: 403 });
    });
    vi.stubGlobal('fetch', send);
    Didban.init({
      apiKey: 'test',
      appName: 'browser-app',
      config: {
        baseUrl: 'https://collector.example',
        captureConsoleErrors: false,
      },
    });

    await fetch('https://service.example/files/move', { method: 'PUT' });
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));

    const axiosError = Object.assign(new Error('Request failed with status code 403'), {
      name: 'AxiosError',
      status: 403,
      config: {
        method: 'put',
        baseURL: 'https://service.example',
        url: '/files/move',
      },
      response: { status: 403 },
    });
    const rejection = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(rejection, 'reason', { value: axiosError });
    window.dispatchEvent(rejection);
    await Promise.resolve();

    expect(send).toHaveBeenCalledTimes(2);
    const reports = send.mock.calls.filter(([input]) =>
      String(input).includes('collector.example'),
    );
    expect(reports).toHaveLength(1);
  });
});
