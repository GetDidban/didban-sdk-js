import {
  Injectable,
  Inject,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, type Subscription } from 'rxjs';
import type { DidbanSpan } from '@didban/node-sdk';
import { DIDBAN_TRACE_METADATA } from './constants';
import { DidbanService } from './didban.service';
import type { DidbanTraceMetadata } from './types';

@Injectable()
export class DidbanInterceptor implements NestInterceptor {
  constructor(
    @Inject(DidbanService) private readonly didban: DidbanService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.didban.integration.enableInterceptor) return next.handle();

    const metadata = this.reflector.getAllAndOverride<DidbanTraceMetadata>(DIDBAN_TRACE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<{
      method?: string;
      route?: { path?: string };
      url?: string;
    }>();
    const method = request?.method?.toUpperCase() ?? 'CALL';
    const route = request?.route?.path ?? request?.url?.split('?')[0];
    const defaultName = `${context.getClass().name}.${context.getHandler().name}`;
    const name = metadata?.name ?? (route ? `${method} ${route}` : defaultName);
    const { name: _name, ...traceOptions } = metadata ?? {};

    return new Observable((subscriber) => {
      let subscription: Subscription | undefined;
      let settle: (() => void) | undefined;

      const traced = this.didban.trace(
        name,
        (span: DidbanSpan) =>
          new Promise<void>((resolve, reject) => {
            settle = resolve;
            subscription = next.handle().subscribe({
              next: (value) => subscriber.next(value),
              error: (error: unknown) => {
                span.recordException(error);
                reject(error);
                subscriber.error(error);
              },
              complete: () => {
                resolve();
                subscriber.complete();
              },
            });
          }),
        {
          ...traceOptions,
          captureErrors: false,
          attributes: {
            controller: context.getClass().name,
            handler: context.getHandler().name,
            method,
            ...(route ? { route } : {}),
            ...(traceOptions.attributes ?? {}),
          },
          tags: { framework: 'nestjs', ...(traceOptions.tags ?? {}) },
        },
      );
      void Promise.resolve(traced).catch(() => undefined);

      return () => {
        subscription?.unsubscribe();
        settle?.();
      };
    });
  }
}
