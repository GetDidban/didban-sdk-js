import {
  now,
  sanitize,
  sanitizeBody,
  shouldIgnoreUrl,
  truncate,
  type LogLevel,
} from '@didban/core';
import type { ResolvedReactNativeConfig } from './config';

interface InstrumentationHooks {
  addHttp(data: Record<string, unknown>, level?: LogLevel): void;
  reportHttpError(error: Error, data: Record<string, unknown>): void;
}

export class ReactNativeNetworkInstrumentation {
  readonly #config: ResolvedReactNativeConfig;
  readonly #hooks: InstrumentationHooks;
  readonly #reportUrl: string;
  #originalFetch: typeof fetch | undefined;

  constructor(config: ResolvedReactNativeConfig, reportUrl: string, hooks: InstrumentationHooks) {
    this.#config = config;
    this.#reportUrl = reportUrl;
    this.#hooks = hooks;
  }

  start(): void {
    if (!this.#config.captureNetwork || typeof globalThis.fetch !== 'function') return;
    if (this.#originalFetch) return;
    const original = globalThis.fetch;
    this.#originalFetch = original;
    const self = this;

    globalThis.fetch = async function didbanReactNativeFetch(
      this: typeof globalThis,
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      const request =
        typeof Request !== 'undefined' && input instanceof Request ? input : undefined;
      const url = request?.url ?? String(input);
      if (url === self.#reportUrl || shouldIgnoreUrl(url, self.#config.ignoreUrls)) {
        return original.call(this, input, init);
      }
      const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
      const startedAt = now();
      const requestError = new Error();
      const requestBody = self.#config.captureRequestBody
        ? sanitizeBody(
            init?.body ?? (request ? '[Request body stream]' : undefined),
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
          data.responseBody = await self.#readResponse(response);
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

  stop(): void {
    if (this.#originalFetch) globalThis.fetch = this.#originalFetch;
    this.#originalFetch = undefined;
  }

  async #readResponse(response: Response): Promise<unknown> {
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
}

function requestErrorWithMessage(requestError: Error, message: string): Error {
  requestError.message = message;
  if (requestError.stack) {
    const [, ...frames] = requestError.stack.split('\n');
    requestError.stack = `${requestError.name}: ${message}${frames.length ? `\n${frames.join('\n')}` : ''}`;
  }
  return requestError;
}
