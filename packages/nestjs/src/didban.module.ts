import {
  DynamicModule,
  Inject,
  MiddlewareConsumer,
  Module,
  type NestModule,
  type Provider,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { DIDBAN_NEST_OPTIONS } from './constants';
import { DidbanExceptionFilter } from './didban-exception.filter';
import { DidbanInterceptor } from './didban.interceptor';
import { DidbanMiddleware } from './didban.middleware';
import { DidbanService } from './didban.service';
import type { DidbanNestAsyncOptions, DidbanNestOptions, DidbanNestOptionsFactory } from './types';

const integrationProviders: Provider[] = [
  DidbanService,
  DidbanMiddleware,
  { provide: APP_INTERCEPTOR, useClass: DidbanInterceptor },
  { provide: APP_FILTER, useClass: DidbanExceptionFilter },
];

@Module({})
export class DidbanModule implements NestModule {
  constructor(@Inject(DIDBAN_NEST_OPTIONS) private readonly options: DidbanNestOptions) {}

  static forRoot(options: DidbanNestOptions): DynamicModule {
    return {
      module: DidbanModule,
      global: options.global ?? true,
      providers: [{ provide: DIDBAN_NEST_OPTIONS, useValue: options }, ...integrationProviders],
      exports: [DidbanService],
    };
  }

  static forRootAsync(options: DidbanNestAsyncOptions): DynamicModule {
    return {
      module: DidbanModule,
      global: options.global ?? true,
      imports: options.imports ?? [],
      providers: [
        ...this.asyncOptionsProviders(options),
        ...(options.extraProviders ?? []),
        ...integrationProviders,
      ],
      exports: [DidbanService],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    if (this.options.enableMiddleware !== false) {
      consumer.apply(DidbanMiddleware).forRoutes('*');
    }
  }

  private static asyncOptionsProviders(options: DidbanNestAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: DIDBAN_NEST_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ];
    }
    if (options.useClass) {
      return [
        options.useClass,
        {
          provide: DIDBAN_NEST_OPTIONS,
          useFactory: (factory: DidbanNestOptionsFactory) => factory.createDidbanOptions(),
          inject: [options.useClass],
        },
      ];
    }
    throw new TypeError('DidbanModule.forRootAsync requires useFactory or useClass');
  }
}
