import {
  ArgumentsHost,
  Catch,
  HttpException,
  Inject,
  Injectable,
  type ExceptionFilter,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { DidbanService } from './didban.service';

@Catch()
@Injectable()
export class DidbanExceptionFilter extends BaseExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(DidbanService) private readonly didban: DidbanService,
    @Inject(HttpAdapterHost) adapterHost: HttpAdapterHost,
  ) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (this.#shouldCapture(exception)) {
      const request = host.switchToHttp().getRequest<{
        method?: string;
        originalUrl?: string;
        url?: string;
      }>();
      void this.didban.captureException(exception, {
        tags: { framework: 'nestjs' },
        extra: {
          source: 'nestjs.exception-filter',
          request: {
            method: request?.method,
            url: request?.originalUrl ?? request?.url,
          },
        },
      });
    }
    super.catch(exception, host);
  }

  #shouldCapture(exception: unknown): boolean {
    if (!this.didban.integration.enableExceptionFilter) return false;
    if (!(exception instanceof HttpException)) return true;
    return this.didban.integration.captureHttpExceptions || exception.getStatus() >= 500;
  }
}
