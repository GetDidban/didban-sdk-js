import { resolveCoreConfig, type ResolvedCoreConfig } from '@didban/core';
import type { DidbanConfig } from './types';

export const DEFAULT_BROWSER_CONFIG = {
  captureClicks: true,
  captureInputs: true,
  captureNetwork: true,
  captureRequestBody: true,
  captureResponseBody: true,
  reportFailedRequests: true,
  maskAllInputs: false,
  maskSelectors: [
    'input[type=password]',
    '[data-didban-mask]',
    '[autocomplete=current-password]',
    '[autocomplete=new-password]',
    '[autocomplete=cc-number]',
    '[autocomplete=cc-csc]',
  ],
  ignoreUrls: [],
} as const;

export interface ResolvedBrowserConfig extends ResolvedCoreConfig {
  captureClicks: boolean;
  captureInputs: boolean;
  captureNetwork: boolean;
  captureRequestBody: boolean;
  captureResponseBody: boolean;
  reportFailedRequests: boolean;
  maskAllInputs: boolean;
  maskSelectors: string[];
  ignoreUrls: Array<string | RegExp>;
}

export function resolveBrowserConfig(config: DidbanConfig = {}): ResolvedBrowserConfig {
  return {
    ...resolveCoreConfig(config),
    captureClicks: config.captureClicks ?? DEFAULT_BROWSER_CONFIG.captureClicks,
    captureInputs: config.captureInputs ?? DEFAULT_BROWSER_CONFIG.captureInputs,
    captureNetwork: config.captureNetwork ?? DEFAULT_BROWSER_CONFIG.captureNetwork,
    captureRequestBody: config.captureRequestBody ?? DEFAULT_BROWSER_CONFIG.captureRequestBody,
    captureResponseBody: config.captureResponseBody ?? DEFAULT_BROWSER_CONFIG.captureResponseBody,
    reportFailedRequests:
      config.reportFailedRequests ?? DEFAULT_BROWSER_CONFIG.reportFailedRequests,
    maskAllInputs: config.maskAllInputs ?? DEFAULT_BROWSER_CONFIG.maskAllInputs,
    maskSelectors: [...(config.maskSelectors ?? DEFAULT_BROWSER_CONFIG.maskSelectors)],
    ignoreUrls: [...(config.ignoreUrls ?? DEFAULT_BROWSER_CONFIG.ignoreUrls)],
  };
}
