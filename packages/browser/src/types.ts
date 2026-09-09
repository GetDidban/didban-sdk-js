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
  /** Send a warning report when an HTTP request exceeds slowRequestThresholdMs. */
  reportSlowRequests?: boolean;
  /** Maximum acceptable request duration in milliseconds. */
  slowRequestThresholdMs?: number;
  maskAllInputs?: boolean;
  maskSelectors?: string[];
  ignoreUrls?: Array<string | RegExp>;
}

export type DidbanInitOptions = DidbanCoreInitOptions<DidbanConfig>;
