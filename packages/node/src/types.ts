import type { CaptureContext, DidbanCoreConfig, DidbanCoreInitOptions } from '@didban/core';

export interface DidbanNodeConfig extends DidbanCoreConfig {
  captureUncaughtErrors?: boolean;
  captureUnhandledRejections?: boolean;
  captureProcessWarnings?: boolean;
  captureFetch?: boolean;
  reportFailedRequests?: boolean;
  reportSlowRequests?: boolean;
  reportSlowOperations?: boolean;
  slowRequestThresholdMs?: number;
  slowOperationThresholdMs?: number;
  monitorEventLoop?: boolean;
  eventLoopLagThresholdMs?: number;
  eventLoopCheckIntervalMs?: number;
  eventLoopReportCooldownMs?: number;
  captureHeaders?: boolean;
  ignoreUrls?: Array<string | RegExp>;
}

export type DidbanInitOptions = DidbanCoreInitOptions<DidbanNodeConfig>;

export interface TraceOptions {
  attributes?: Record<string, unknown>;
  tags?: Record<string, string>;
  slowThresholdMs?: number;
  captureErrors?: boolean;
}

export interface SpanEndOptions {
  status?: 'ok' | 'error';
  error?: unknown;
  attributes?: Record<string, unknown>;
}

export interface DidbanSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId: string | undefined;
  readonly name: string;
  setAttribute(key: string, value: unknown): this;
  setAttributes(attributes: Record<string, unknown>): this;
  recordException(error: unknown): this;
  end(options?: SpanEndOptions): number;
}

export interface NodeRequestLike {
  method?: string;
  url?: string;
  originalUrl?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

export interface NodeResponseLike {
  statusCode: number;
  once(event: 'finish' | 'close', listener: () => void): unknown;
}

export type NextFunction = (error?: unknown) => void;

export interface RequestHandlerOptions {
  slowThresholdMs?: number;
  captureHeaders?: boolean;
}

export interface CaptureMessageOptions extends CaptureContext {
  name?: string;
}
