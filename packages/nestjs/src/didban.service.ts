import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import {
  DidbanNodeClient,
  type CaptureContext,
  type CaptureMessageOptions,
  type DidbanSpan,
  type DidbanUser,
  type TraceOptions,
} from '@didban/node-sdk';
import { DIDBAN_NEST_OPTIONS } from './constants';
import type { DidbanNestOptions, ResolvedNestIntegrationOptions } from './types';

@Injectable()
export class DidbanService implements OnModuleDestroy {
  readonly client: DidbanNodeClient;
  readonly integration: ResolvedNestIntegrationOptions;

  constructor(@Inject(DIDBAN_NEST_OPTIONS) options: DidbanNestOptions) {
    const {
      global: _global,
      enableMiddleware,
      enableInterceptor,
      enableExceptionFilter,
      captureHttpExceptions,
      ...nodeOptions
    } = options;
    this.integration = {
      enableMiddleware: enableMiddleware ?? true,
      enableInterceptor: enableInterceptor ?? true,
      enableExceptionFilter: enableExceptionFilter ?? true,
      captureHttpExceptions: captureHttpExceptions ?? false,
    };
    this.client = new DidbanNodeClient(nodeOptions).start();
  }

  captureException(input: unknown, context?: CaptureContext): Promise<boolean> {
    return this.client.captureException(input, context);
  }

  captureMessage(message: string, options?: CaptureMessageOptions): Promise<boolean> {
    return this.client.captureMessage(message, options);
  }

  trace<T>(name: string, operation: (span: DidbanSpan) => T, options?: TraceOptions): T {
    return this.client.trace(name, operation, options);
  }

  startSpan(name: string, options?: TraceOptions): DidbanSpan {
    return this.client.startSpan(name, options);
  }

  setUser(user: DidbanUser | undefined): void {
    this.client.setUser(user);
  }

  addBreadcrumb(message: string, data?: Record<string, unknown>): void {
    this.client.addBreadcrumb(message, data);
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }
}
