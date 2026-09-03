import type { DidbanCoreConfig, DidbanCoreInitOptions } from '@didban/core';

export interface DidbanConfig extends DidbanCoreConfig {
  captureClicks?: boolean;
  captureInputs?: boolean;
  captureNetwork?: boolean;
  captureRequestBody?: boolean;
  captureResponseBody?: boolean;
  reportFailedRequests?: boolean;
  maskAllInputs?: boolean;
  maskSelectors?: string[];
  ignoreUrls?: Array<string | RegExp>;
}

export type DidbanInitOptions = DidbanCoreInitOptions<DidbanConfig>;
