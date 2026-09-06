import {
  now,
  sanitize,
  sanitizeBody,
  shouldIgnoreUrl,
  truncate,
  type LogLevel,
} from '@didban/core';
import type { ResolvedBrowserConfig } from './config';

interface InstrumentationHooks {
  addHttp(data: Record<string, unknown>, level?: LogLevel): void;
  reportHttpError(error: Error, data: Record<string, unknown>): void;
}

interface XhrMeta {
  method: string;
  url: string;
  startedAt: number;
  requestError?: Error;
  requestBody?: unknown;
}

export class NetworkInstrumentation {
  readonly #config: ResolvedBrowserConfig;
  readonly #hooks: InstrumentationHooks;
  readonly #reportUrl: string;
  #originalFetch: typeof fetch | undefined;
  #originalOpen: typeof XMLHttpRequest.prototype.open | undefined;
  #originalSend: typeof XMLHttpRequest.prototype.send | undefined;
  #xhrMeta = new WeakMap<XMLHttpRequest, XhrMeta>();

  constructor(config: ResolvedBrowserConfig, reportUrl: string, hooks: InstrumentationHooks) {
    this.#config = config;
    this.#reportUrl = reportUrl;
    this.#hooks = hooks;
  }

  start(): void {
    if (!this.#config.captureNetwork) return;
    this.#patchFetch();
    this.#patchXhr();
  }

  stop(): void {
    if (this.#originalFetch) globalThis.fetch = this.#originalFetch;
    if (this.#originalOpen && typeof XMLHttpRequest !== 'undefined') {
      XMLHttpRequest.prototype.open = this.#originalOpen;
    }
    if (this.#originalSend && typeof XMLHttpRequest !== 'undefined') {
      XMLHttpRequest.prototype.send = this.#originalSend;
    }
    this.#originalFetch = undefined;
    this.#originalOpen = undefined;
    this.#originalSend = undefined;
  }

  #ignored(url: string): boolean {
    return this.#reportUrl === url || shouldIgnoreUrl(url, this.#config.ignoreUrls);
  }

  #patchFetch(): void {
    if (typeof globalThis.fetch !== 'function' || this.#originalFetch) return;
    const original = globalThis.fetch;
    this.#originalFetch = original;
    const self = this;
    globalThis.fetch = async function didbanFetch(
      this: typeof globalThis,
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      const url = input instanceof Request ? input.url : String(input);
      if (self.#ignored(url)) return original.call(this, input, init);
      const method = (
        init?.method ?? (input instanceof Request ? input.method : 'GET')
      ).toUpperCase();
      const startedAt = now();
      const requestError = new Error();
      const requestBody = self.#config.captureRequestBody
        ? sanitizeBody(
            init?.body ?? (input instanceof Request ? '[Request body stream]' : undefined),
            self.#config.maxValueLength,
          )
        : '[Disabled]';
      try {
        const response = await original.call(this, input, init);
        const data: Record<string, unknown> = {
          transport: 'fetch',
          method,
          url: truncate(url, self.#config.maxValueLength),
          status: response.status,
          ok: response.ok,
          durationMs: Math.round(now() - startedAt),
          requestBody,
        };
        if (self.#config.captureResponseBody) {
          data.responseBody = await self.#readFetchBody(response);
        }
        self.#hooks.addHttp(data, response.ok ? 'info' : 'error');
        if (!response.ok && self.#config.reportFailedRequests) {
          self.#hooks.reportHttpError(
            requestErrorWithMessage(
              requestError,
              `${method} ${url} returned HTTP ${response.status}`,
            ),
            data,
          );
        }
        return response;
      } catch (cause) {
        const error = cause instanceof Error ? cause : new Error(String(cause));
        const data = {
          transport: 'fetch',
          method,
          url: truncate(url, self.#config.maxValueLength),
          durationMs: Math.round(now() - startedAt),
          requestBody,
          error: error.message,
        };
        self.#hooks.addHttp(data, 'error');
        if (self.#config.reportFailedRequests) self.#hooks.reportHttpError(error, data);
        throw cause;
      }
    };
  }

  async #readFetchBody(response: Response): Promise<unknown> {
    try {
      const text = await response.clone().text();
      if (!text) return undefined;
      try {
        return sanitize(JSON.parse(text), this.#config.maxValueLength);
      } catch {
        return truncate(text, this.#config.maxValueLength);
      }
    } catch {
      return '[Unavailable]';
    }
  }

  #patchXhr(): void {
    if (typeof XMLHttpRequest === 'undefined' || this.#originalOpen || this.#originalSend) return;
    const self = this;
    this.#originalOpen = XMLHttpRequest.prototype.open;
    this.#originalSend = XMLHttpRequest.prototype.send;
    const originalOpen = this.#originalOpen;
    const originalSend = this.#originalSend;

    XMLHttpRequest.prototype.open = function didbanOpen(
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ): void {
      self.#xhrMeta.set(this, { method: method.toUpperCase(), url: String(url), startedAt: 0 });
      Reflect.apply(originalOpen, this, [method, url, ...rest]);
    } as typeof XMLHttpRequest.prototype.open;

    XMLHttpRequest.prototype.send = function didbanSend(
      this: XMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null,
    ): void {
      const meta = self.#xhrMeta.get(this);
      if (!meta || self.#ignored(meta.url)) return originalSend.call(this, body);
      meta.startedAt = now();
      meta.requestError = new Error();
      if (self.#config.captureRequestBody) {
        meta.requestBody = sanitizeBody(body, self.#config.maxValueLength);
      }
      this.addEventListener('loadend', () => self.#onXhrDone(this), { once: true });
      return originalSend.call(this, body);
    };
  }

  #onXhrDone(xhr: XMLHttpRequest): void {
    const meta = this.#xhrMeta.get(xhr);
    if (!meta) return;
    const ok = xhr.status >= 200 && xhr.status < 400;
    const data: Record<string, unknown> = {
      transport: 'xhr',
      method: meta.method,
      url: truncate(meta.url, this.#config.maxValueLength),
      status: xhr.status,
      ok,
      durationMs: Math.round(now() - meta.startedAt),
      requestBody: meta.requestBody,
    };
    if (this.#config.captureResponseBody) {
      try {
        data.responseBody = sanitize(
          xhr.responseType === 'json' ? xhr.response : xhr.responseText,
          this.#config.maxValueLength,
        );
      } catch {
        data.responseBody = '[Unavailable]';
      }
    }
    this.#hooks.addHttp(data, ok ? 'info' : 'error');
    if (!ok && this.#config.reportFailedRequests) {
      this.#hooks.reportHttpError(
        requestErrorWithMessage(
          meta.requestError,
          `${meta.method} ${meta.url} returned HTTP ${xhr.status || 0}`,
        ),
        data,
      );
    }
  }
}

function requestErrorWithMessage(requestError: Error | undefined, message: string): Error {
  if (!requestError) return new Error(message);
  requestError.message = message;
  if (requestError.stack) {
    const [, ...frames] = requestError.stack.split('\n');
    requestError.stack = `${requestError.name}: ${message}${frames.length ? `\n${frames.join('\n')}` : ''}`;
  }
  return requestError;
}
