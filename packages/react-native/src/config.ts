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
  enableScreenProfiling: true,
  reportFpsDrops: true,
  fpsSampleWindowMs: 5_000,
  minimumFps: 50,
  slowFrameThresholdMs: 32,
  slowFramePercentageThreshold: 20,
  fpsReportCooldownMs: 30_000,
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
  enableScreenProfiling: boolean;
  reportFpsDrops: boolean;
  fpsSampleWindowMs: number;
  minimumFps: number;
  slowFrameThresholdMs: number;
  slowFramePercentageThreshold: number;
  fpsReportCooldownMs: number;
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
    enableScreenProfiling:
      config.enableScreenProfiling ?? DEFAULT_REACT_NATIVE_CONFIG.enableScreenProfiling,
    reportFpsDrops: config.reportFpsDrops ?? DEFAULT_REACT_NATIVE_CONFIG.reportFpsDrops,
    fpsSampleWindowMs: Math.max(
      1_000,
      config.fpsSampleWindowMs ?? DEFAULT_REACT_NATIVE_CONFIG.fpsSampleWindowMs,
    ),
    minimumFps: Math.max(
      1,
      Math.min(240, config.minimumFps ?? DEFAULT_REACT_NATIVE_CONFIG.minimumFps),
    ),
    slowFrameThresholdMs: Math.max(
      16,
      config.slowFrameThresholdMs ?? DEFAULT_REACT_NATIVE_CONFIG.slowFrameThresholdMs,
    ),
    slowFramePercentageThreshold: Math.max(
      0,
      Math.min(
        100,
        config.slowFramePercentageThreshold ??
          DEFAULT_REACT_NATIVE_CONFIG.slowFramePercentageThreshold,
      ),
    ),
    fpsReportCooldownMs: Math.max(
      0,
      config.fpsReportCooldownMs ?? DEFAULT_REACT_NATIVE_CONFIG.fpsReportCooldownMs,
    ),
  };
}
