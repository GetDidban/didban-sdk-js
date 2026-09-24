import 'reflect-metadata';
import { BadRequestException, type ArgumentsHost, type ExecutionContext } from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DidbanExceptionFilter } from '../src/didban-exception.filter';
import { DidbanInterceptor } from '../src/didban.interceptor';
import { DidbanService } from '../src/didban.service';
import { DidbanTrace } from '../src/didban-trace.decorator';

function createService(overrides: Record<string, unknown> = {}) {
  const reports: Array<Record<string, any>> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.body) reports.push(JSON.parse(String(init.body)));
      return new Response(null, { status: 202 });
    }),
  );
  const service = new DidbanService({
    apiKey: 'nest-test-key',
    appName: 'nest-test',
    config: {
      baseUrl: 'https://collector.example',
      captureFetch: false,
      monitorEventLoop: false,
      captureUncaughtErrors: false,
      captureUnhandledRejections: false,
      slowOperationThresholdMs: 10_000,
    },
    ...overrides,
  });
  return { service, reports };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('@didban/nestjs', () => {
  it('captures handled Nest exceptions with framework context', async () => {
    const { service, reports } = createService();
    await service.captureException(new Error('controller failed'), {
      tags: { framework: 'nestjs' },
      extra: { source: 'nestjs.exception-filter' },
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.error.message).toBe('controller failed');
    expect(reports[0]?.context.tags.framework).toBe('nestjs');
    service.onModuleDestroy();
  });

  it('traces a controller handler and honors @DidbanTrace metadata', async () => {
    const { service } = createService();
    class OrdersController {
      create() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(OrdersController.prototype, 'create');
    DidbanTrace('orders.create', { slowThresholdMs: 10_000 })(
      OrdersController.prototype,
      'create',
      descriptor,
    );
    const controller = new OrdersController();
    const context = {
      getHandler: () => controller.create,
      getClass: () => OrdersController,
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', route: { path: '/orders' } }),
      }),
    } as unknown as ExecutionContext;
    const interceptor = new DidbanInterceptor(service, new Reflector());

    await expect(
      lastValueFrom(interceptor.intercept(context, { handle: () => of({ id: 'ord-1' }) })),
    ).resolves.toEqual({ id: 'ord-1' });
    expect(service.client.getBreadcrumbs()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'performance', message: 'orders.create' }),
      ]),
    );
    service.onModuleDestroy();
  });

  it('does not report expected 4xx HttpExceptions by default', async () => {
    const { service, reports } = createService();
    const reply = vi.fn();
    const adapterHost = {
      httpAdapter: {
        isHeadersSent: () => false,
        reply,
      },
    } as unknown as HttpAdapterHost;
    const host = {
      getArgByIndex: (index: number) => (index === 1 ? {} : undefined),
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/missing' }),
        getResponse: () => ({}),
      }),
    } as ArgumentsHost;
    const filter = new DidbanExceptionFilter(service, adapterHost);

    filter.catch(new BadRequestException('invalid input'), host);
    await Promise.resolve();

    expect(reports).toHaveLength(0);
    expect(reply).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ statusCode: 400, message: 'invalid input' }),
      400,
    );
    service.onModuleDestroy();
  });
});
