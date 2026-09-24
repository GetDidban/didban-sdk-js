import type { Breadcrumb, CaptureContext, DidbanUser } from '@didban/core';
import { DidbanNodeClient } from './client';
import type {
  CaptureMessageOptions,
  DidbanInitOptions,
  DidbanSpan,
  RequestHandlerOptions,
  TraceOptions,
} from './types';

export class Didban {
  static #client: DidbanNodeClient | undefined;

  static init(options: DidbanInitOptions): DidbanNodeClient {
    this.#client?.destroy();
    this.#client = new DidbanNodeClient(options).start();
    return this.#client;
  }

  static capture(input: unknown, context?: CaptureContext): Promise<boolean> {
    return this.#requireClient().capture(input, context);
  }

  static captureException(input: unknown, context?: CaptureContext): Promise<boolean> {
    return this.#requireClient().captureException(input, context);
  }

  static captureMessage(message: string, options?: CaptureMessageOptions): Promise<boolean> {
    return this.#requireClient().captureMessage(message, options);
  }

  static trace<T>(name: string, operation: (span: DidbanSpan) => T, options?: TraceOptions): T {
    return this.#requireClient().trace(name, operation, options);
  }

  static startSpan(name: string, options?: TraceOptions): DidbanSpan {
    return this.#requireClient().startSpan(name, options);
  }

  static requestHandler(options?: RequestHandlerOptions) {
    return this.#requireClient().requestHandler(options);
  }

  static errorHandler() {
    return this.#requireClient().errorHandler();
  }

  static setUser(user: DidbanUser | undefined): void {
    this.#requireClient().setUser(user);
  }

  static addBreadcrumb(message: string, data?: Record<string, unknown>): Breadcrumb {
    return this.#requireClient().addBreadcrumb(message, data);
  }

  static destroy(): void {
    this.#client?.destroy();
    this.#client = undefined;
  }

  static #requireClient(): DidbanNodeClient {
    if (!this.#client) throw new Error('Call Didban.init({ apiKey, appName }) first');
    return this.#client;
  }
}
