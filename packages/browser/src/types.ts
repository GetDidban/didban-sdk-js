import type { DidbanCoreConfig, DidbanCoreInitOptions } from '@didban/core';

export interface DidbanConfig extends DidbanCoreConfig {
  /** Capture Error objects written to console.error, including errors handled by React boundaries. */
  captureConsoleErrors?: boolean;
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
