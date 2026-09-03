import { resolveCoreConfig, type ResolvedCoreConfig } from '@didban/core';
import type { DidbanReactNativeConfig } from './types';

export const DEFAULT_REACT_NATIVE_CONFIG = {
  captureAppErrors: true,
  captureUnhandledRejections: true,
  captureNetwork: true,
  captureRequestBody: true,
  captureResponseBody: true,
  reportFailedRequests: true,
  ignoreUrls: [],
} as const;

export interface ResolvedReactNativeConfig extends ResolvedCoreConfig {
  captureAppErrors: boolean;
  captureUnhandledRejections: boolean;
  captureNetwork: boolean;
  captureRequestBody: boolean;
  captureResponseBody: boolean;
  reportFailedRequests: boolean;
  ignoreUrls: Array<string | RegExp>;
  getDeviceContext?: DidbanReactNativeConfig['getDeviceContext'];
}

export function resolveReactNativeConfig(
  config: DidbanReactNativeConfig = {},
): ResolvedReactNativeConfig {
  return {
    ...resolveCoreConfig(config),
    captureAppErrors: config.captureAppErrors ?? DEFAULT_REACT_NATIVE_CONFIG.captureAppErrors,
    captureUnhandledRejections:
      config.captureUnhandledRejections ?? DEFAULT_REACT_NATIVE_CONFIG.captureUnhandledRejections,
    captureNetwork: config.captureNetwork ?? DEFAULT_REACT_NATIVE_CONFIG.captureNetwork,
    captureRequestBody: config.captureRequestBody ?? DEFAULT_REACT_NATIVE_CONFIG.captureRequestBody,
    captureResponseBody:
      config.captureResponseBody ?? DEFAULT_REACT_NATIVE_CONFIG.captureResponseBody,
    reportFailedRequests:
      config.reportFailedRequests ?? DEFAULT_REACT_NATIVE_CONFIG.reportFailedRequests,
    ignoreUrls: [...(config.ignoreUrls ?? DEFAULT_REACT_NATIVE_CONFIG.ignoreUrls)],
    ...(config.getDeviceContext ? { getDeviceContext: config.getDeviceContext } : {}),
  };
}
