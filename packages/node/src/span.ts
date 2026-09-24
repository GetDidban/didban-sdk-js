import { performance } from 'node:perf_hooks';
import { createId, normalizeError } from '@didban/core';
import type { DidbanSpan, SpanEndOptions, TraceOptions } from './types';

export interface SpanSnapshot {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startedAt: string;
  durationMs: number;
  status: 'ok' | 'error';
  attributes: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

export class NodeSpan implements DidbanSpan {
  readonly traceId: string;
  readonly spanId = createId();
  readonly parentSpanId: string | undefined;
  readonly name: string;
  readonly options: TraceOptions;
  readonly #started = performance.now();
  readonly #startedAt = new Date().toISOString();
  readonly #onEnd: (span: SpanSnapshot, options: TraceOptions) => void;
  readonly #attributes: Record<string, unknown>;
  #error: Error | undefined;
  #ended = false;
  #durationMs = 0;

  constructor(
    name: string,
    parent: NodeSpan | undefined,
    options: TraceOptions,
    onEnd: (span: SpanSnapshot, options: TraceOptions) => void,
  ) {
    this.name = name || 'operation';
    this.traceId = parent?.traceId ?? createId();
    this.parentSpanId = parent?.spanId;
    this.options = options;
    this.#attributes = { ...(options.attributes ?? {}) };
    this.#onEnd = onEnd;
  }

  setAttribute(key: string, value: unknown): this {
    this.#attributes[key] = value;
    return this;
  }

  setAttributes(attributes: Record<string, unknown>): this {
    Object.assign(this.#attributes, attributes);
    return this;
  }

  recordException(input: unknown): this {
    this.#error = normalizeError(input);
    return this;
  }

  end(options: SpanEndOptions = {}): number {
    if (this.#ended) return this.#durationMs;
    this.#ended = true;
    this.#durationMs = Math.max(0, Math.round(performance.now() - this.#started));
    if (options.attributes) this.setAttributes(options.attributes);
    if (options.error !== undefined) this.recordException(options.error);
    const status = options.status ?? (this.#error ? 'error' : 'ok');
    this.#onEnd(
      {
        traceId: this.traceId,
        spanId: this.spanId,
        ...(this.parentSpanId ? { parentSpanId: this.parentSpanId } : {}),
        name: this.name,
        startedAt: this.#startedAt,
        durationMs: this.#durationMs,
        status,
        attributes: { ...this.#attributes },
        ...(this.#error
          ? {
              error: {
                name: this.#error.name,
                message: this.#error.message,
                ...(this.#error.stack ? { stack: this.#error.stack } : {}),
              },
            }
          : {}),
      },
      this.options,
    );
    return this.#durationMs;
  }
}
