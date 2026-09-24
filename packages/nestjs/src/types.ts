import type { ModuleMetadata, Provider, Type } from '@nestjs/common';
import type { DidbanInitOptions, TraceOptions } from '@didban/node-sdk';

export interface DidbanNestOptions extends DidbanInitOptions {
  /** Register the module globally. Defaults to true. */
  global?: boolean;
  /** Add request context and an HTTP root span. Defaults to true. */
  enableMiddleware?: boolean;
  /** Trace each controller handler. Defaults to true. */
  enableInterceptor?: boolean;
  /** Capture exceptions handled by Nest. Defaults to true. */
  enableExceptionFilter?: boolean;
  /** Also report Nest HttpException responses below status 500. Defaults to false. */
  captureHttpExceptions?: boolean;
}

export interface ResolvedNestIntegrationOptions {
  enableMiddleware: boolean;
  enableInterceptor: boolean;
  enableExceptionFilter: boolean;
  captureHttpExceptions: boolean;
}

export interface DidbanNestOptionsFactory {
  createDidbanOptions(): DidbanNestOptions | Promise<DidbanNestOptions>;
}

export interface DidbanNestAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  global?: boolean;
  inject?: Array<string | symbol | Type<unknown>>;
  useFactory?: (...args: any[]) => DidbanNestOptions | Promise<DidbanNestOptions>;
  useClass?: Type<DidbanNestOptionsFactory>;
  extraProviders?: Provider[];
}

export interface DidbanTraceMetadata extends TraceOptions {
  name?: string;
}
