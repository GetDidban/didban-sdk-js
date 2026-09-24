import { AsyncLocalStorage } from 'node:async_hooks';
import { hostname, release } from 'node:os';
import { performance } from 'node:perf_hooks';
import {
  DidbanCoreClient,
  normalizeError,
  sanitize,
  shouldIgnoreUrl,
  truncate,
  type CaptureContext,
  type DeviceContext,
  type PageContext,
} from '@didban/core';
import { resolveNodeConfig, type ResolvedNodeConfig } from './config';
import { NodeSpan, type SpanSnapshot } from './span';
import type {
  CaptureMessageOptions,
  DidbanInitOptions,
  DidbanSpan,
  NextFunction,
  NodeRequestLike,
  NodeResponseLike,
  RequestHandlerOptions,
  TraceOptions,
} from './types';

const SDK_NAME = '@didban/node-sdk';
const SDK_VERSION = '0.1.0';

interface ActiveContext {
  span?: NodeSpan;
  page?: PageContext;
  request?: Record<string, unknown>;
}

export class DidbanNodeClient extends DidbanCoreClient {
  readonly #nodeConfig: ResolvedNodeConfig;
  readonly #storage: AsyncLocalStorage<ActiveContext>;
  readonly #capturedErrors = new WeakSet<object>();
  #started = false;
  #originalFetch: typeof fetch | undefined;
  #eventLoopTimer: NodeJS.Timeout | undefined;
  #lastLagReport = 0;

  constructor(options: DidbanInitOptions) {
    const config = resolveNodeConfig(options?.config);
    const storage = new AsyncLocalStorage<ActiveContext>();
    super({
      apiKey: options?.apiKey ?? '',
      appName: options?.appName ?? '',
      config,
      sdk: { name: SDK_NAME, version: SDK_VERSION },
      getPageContext: () => storage.getStore()?.page ?? {},
      getDeviceContext: nodeDeviceContext,
    });
    this.#nodeConfig = config;
    this.#storage = storage;
  }

  start(): this {
    if (this.#started) return this;
    if (this.#nodeConfig.captureUncaughtErrors) {
      process.on('uncaughtExceptionMonitor', this.#onUncaughtException);
    }
    if (this.#nodeConfig.captureUnhandledRejections) {
      process.on('unhandledRejection', this.#onUnhandledRejection);
    }
    if (this.#nodeConfig.captureProcessWarnings) process.on('warning', this.#onWarning);
    this.#patchFetch();
    this.#startEventLoopMonitor();
    this.#started = true;
    return this;
  }

  destroy(): void {
    if (!this.#started) return;
    process.removeListener('uncaughtExceptionMonitor', this.#onUncaughtException);
    process.removeListener('unhandledRejection', this.#onUnhandledRejection);
    process.removeListener('warning', this.#onWarning);
    if (this.#originalFetch) globalThis.fetch = this.#originalFetch;
    this.#originalFetch = undefined;
    if (this.#eventLoopTimer) clearInterval(this.#eventLoopTimer);
    this.#eventLoopTimer = undefined;
    this.#storage.disable();
    this.#started = false;
  }

  override capture(input: unknown, context?: CaptureContext): Promise<boolean> {
    const active = this.#storage.getStore();
    const trace = active?.span ? spanIdentity(active.span) : undefined;
    return super.capture(input, {
      ...context,
      tags: { ...(trace ? { trace: 'true' } : {}), ...(context?.tags ?? {}) },
      extra: {
        ...(active?.request ? { request: active.request } : {}),
        ...(trace ? { trace } : {}),
        ...(context?.extra ?? {}),
      },
    });
  }

  captureException(input: unknown, context?: CaptureContext): Promise<boolean> {
    return this.capture(input, context);
  }

  captureMessage(message: string, options: CaptureMessageOptions = {}): Promise<boolean> {
    const error = new Error(message);
    error.name = options.name ?? 'Message';
    const { name: _name, ...context } = options;
    return this.capture(error, { level: context.level ?? 'info', ...context });
  }

  startSpan(name: string, options: TraceOptions = {}): DidbanSpan {
    return this.#createSpan(name, options);
  }

  trace<T>(name: string, operation: (span: DidbanSpan) => T, options?: TraceOptions): T;
  trace<T>(
    name: string,
    operation: (span: DidbanSpan) => Promise<T>,
    options?: TraceOptions,
  ): Promise<T>;
  trace<T>(
    name: string,
    operation: (span: DidbanSpan) => T | Promise<T>,
    options: TraceOptions = {},
  ): T | Promise<T> {
    const span = this.#createSpan(name, options);
    return this.#storage.run({ ...(this.#storage.getStore() ?? {}), span }, () => {
      try {
        const result = operation(span);
        if (isPromiseLike(result)) {
          return Promise.resolve(result).then(
            (value) => {
              span.end();
              return value;
            },
            (error: unknown) => {
              span.end({ status: 'error', error });
              throw error;
            },
          );
        }
        span.end();
        return result;
      } catch (error) {
        span.end({ status: 'error', error });
        throw error;
      }
    });
  }

  requestHandler(options: RequestHandlerOptions = {}) {
    return (request: NodeRequestLike, response: NodeResponseLike, next: NextFunction): void => {
      const method = (request.method ?? 'GET').toUpperCase();
      const url = request.originalUrl ?? request.url ?? '/';
      const requestData: Record<string, unknown> = {
        method,
        url: truncate(url, this.#nodeConfig.maxValueLength),
        ...(request.socket?.remoteAddress ? { ip: request.socket.remoteAddress } : {}),
      };
      if (options.captureHeaders ?? this.#nodeConfig.captureHeaders) {
        requestData.headers = sanitize(request.headers ?? {}, this.#nodeConfig.maxValueLength);
      }
      const span = this.#createSpan(`HTTP ${method} ${routeName(url)}`, {
        attributes: requestData,
        slowThresholdMs: options.slowThresholdMs ?? this.#nodeConfig.slowRequestThresholdMs,
      });
      let ended = false;
      const end = () => {
        if (ended) return;
        ended = true;
        span.end({
          status: response.statusCode >= 500 ? 'error' : 'ok',
          attributes: { statusCode: response.statusCode },
        });
      };
      response.once('finish', end);
      response.once('close', end);
      const page = { url, route: routeName(url), title: `${method} ${routeName(url)}` };
      this.#storage.run({ span, page, request: requestData }, () => {
        try {
          next();
        } catch (error) {
          span.recordException(error);
          void this.#captureAutomatic(error, 'middleware');
          end();
          throw error;
        }
      });
    };
  }

  errorHandler() {
    return (
      error: unknown,
      request: NodeRequestLike,
      _response: NodeResponseLike,
      next: NextFunction,
    ): void => {
      void this.captureException(error, {
        extra: {
          source: 'middleware.error',
          request: { method: request.method, url: request.originalUrl ?? request.url },
        },
      });
      next(error);
    };
  }

  readonly #onUncaughtException = (error: Error, origin: NodeJS.UncaughtExceptionOrigin): void => {
    void this.#captureAutomatic(error, 'uncaughtException', { origin });
  };

  readonly #onUnhandledRejection = (reason: unknown): void => {
    void this.#captureAutomatic(reason, 'unhandledRejection');
  };

  readonly #onWarning = (warning: Error): void => {
    void this.#captureAutomatic(warning, 'process.warning', {}, 'warning');
  };

  #createSpan(name: string, options: TraceOptions): NodeSpan {
    return new NodeSpan(name, this.#storage.getStore()?.span, options, (snapshot, spanOptions) => {
      this.#finishSpan(snapshot, spanOptions);
    });
  }

  #finishSpan(span: SpanSnapshot, options: TraceOptions): void {
    this.addClue(
      span.name,
      span as unknown as Record<string, unknown>,
      'performance',
      span.status === 'error' ? 'error' : 'info',
    );
    if (span.error && options.captureErrors !== false) {
      const error = new Error(span.error.message);
      error.name = span.error.name;
      if (span.error.stack) error.stack = span.error.stack;
      void this.#captureAutomatic(error, 'trace', { trace: span });
      return;
    }
    const threshold = options.slowThresholdMs ?? this.#nodeConfig.slowOperationThresholdMs;
    if (this.#nodeConfig.reportSlowOperations && span.durationMs >= threshold) {
      const error = new Error(`Slow operation: ${span.name} (${span.durationMs}ms)`);
      error.name = 'SlowOperationError';
      void this.capture(error, {
        level: 'warning',
        tags: { type: 'performance', operation: span.name, ...(options.tags ?? {}) },
        extra: { trace: span, slowThresholdMs: threshold },
      });
    }
  }

  #captureAutomatic(
    input: unknown,
    source: string,
    extra: Record<string, unknown> = {},
    level: 'warning' | 'error' = 'error',
  ): Promise<boolean> | undefined {
    if (typeof input === 'object' && input !== null) {
      if (this.#capturedErrors.has(input)) return;
      this.#capturedErrors.add(input);
    }
    return this.capture(input, { level, extra: { source, ...extra } });
  }

  #patchFetch(): void {
    if (!this.#nodeConfig.captureFetch || typeof globalThis.fetch !== 'function') return;
    const original = globalThis.fetch;
    this.#originalFetch = original;
    const client = this;
    globalThis.fetch = async function didbanNodeFetch(
      this: typeof globalThis,
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> {
      const url = input instanceof Request ? input.url : String(input);
      if (client.#ignored(url)) return original.call(this, input, init);
      const method = (
        init?.method ?? (input instanceof Request ? input.method : 'GET')
      ).toUpperCase();
      const startedAt = performance.now();
      try {
        const response = await original.call(this, input, init);
        const data = {
          transport: 'fetch',
          method,
          url: truncate(url, client.#nodeConfig.maxValueLength),
          status: response.status,
          ok: response.ok,
          durationMs: Math.round(performance.now() - startedAt),
        };
        client.addClue('HTTP request', data, 'http', response.ok ? 'info' : 'error');
        if (!response.ok && client.#nodeConfig.reportFailedRequests) {
          const error = new Error(`${method} ${url} returned HTTP ${response.status}`);
          error.name = 'HttpRequestError';
          void client.#captureAutomatic(error, 'fetch', { http: data });
        } else if (
          client.#nodeConfig.reportSlowRequests &&
          data.durationMs >= client.#nodeConfig.slowRequestThresholdMs
        ) {
          const error = new Error(`Slow HTTP request: ${method} ${url}`);
          error.name = 'SlowHttpRequestError';
          void client.capture(error, {
            level: 'warning',
            tags: { type: 'performance', operation: 'http' },
            extra: {
              http: data,
              slowRequestThresholdMs: client.#nodeConfig.slowRequestThresholdMs,
            },
          });
        }
        return response;
      } catch (cause) {
        const data = {
          transport: 'fetch',
          method,
          url,
          durationMs: Math.round(performance.now() - startedAt),
        };
        client.addClue('HTTP request failed', data, 'http', 'error');
        if (client.#nodeConfig.reportFailedRequests) {
          void client.#captureAutomatic(cause, 'fetch', { http: data });
        }
        throw cause;
      }
    };
  }

  #ignored(url: string): boolean {
    return url === this.reportUrl || shouldIgnoreUrl(url, this.#nodeConfig.ignoreUrls);
  }

  #startEventLoopMonitor(): void {
    if (!this.#nodeConfig.monitorEventLoop) return;
    let previous = performance.now();
    const interval = this.#nodeConfig.eventLoopCheckIntervalMs;
    this.#eventLoopTimer = setInterval(() => {
      const current = performance.now();
      const lagMs = Math.max(0, Math.round(current - previous - interval));
      previous = current;
      if (lagMs < this.#nodeConfig.eventLoopLagThresholdMs) return;
      if (Date.now() - this.#lastLagReport < this.#nodeConfig.eventLoopReportCooldownMs) return;
      this.#lastLagReport = Date.now();
      const error = new Error(`Event loop blocked for approximately ${lagMs}ms`);
      error.name = 'EventLoopLagError';
      void this.capture(error, {
        level: 'warning',
        tags: { type: 'performance', operation: 'event-loop' },
        extra: { performance: { lagMs, thresholdMs: this.#nodeConfig.eventLoopLagThresholdMs } },
      });
    }, interval);
    this.#eventLoopTimer.unref();
  }
}

function nodeDeviceContext(): DeviceContext {
  return {
    userAgent: `Node.js/${process.version}`,
    ...(process.env.LANG ? { language: process.env.LANG } : {}),
    platform: process.platform,
    osVersion: release(),
    architecture: process.arch,
    hostname: hostname(),
    pid: process.pid,
  };
}

function routeName(url: string): string {
  return url.split('?')[0] || '/';
}

function spanIdentity(span: NodeSpan): Record<string, string> {
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    ...(span.parentSpanId ? { parentSpanId: span.parentSpanId } : {}),
    name: span.name,
  };
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof value === 'object' && value !== null && 'then' in value;
}
