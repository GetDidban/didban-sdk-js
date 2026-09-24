import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, NodeRequestLike, NodeResponseLike } from '@didban/node-sdk';
import { DidbanService } from './didban.service';

@Injectable()
export class DidbanMiddleware implements NestMiddleware {
  readonly #handler: ReturnType<DidbanService['client']['requestHandler']>;

  constructor(@Inject(DidbanService) private readonly didban: DidbanService) {
    this.#handler = didban.client.requestHandler();
  }

  use(request: NodeRequestLike, response: NodeResponseLike, next: NextFunction): void {
    if (!this.didban.integration.enableMiddleware) {
      next();
      return;
    }
    this.#handler(request, response, next);
  }
}
