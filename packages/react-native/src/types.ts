import type { DeviceContext, DidbanCoreConfig, DidbanCoreInitOptions } from '@didban/core';

export interface DidbanReactNativeConfig extends DidbanCoreConfig {
  captureAppErrors?: boolean;
  captureUnhandledRejections?: boolean;
  captureNetwork?: boolean;
  captureRequestBody?: boolean;
  captureResponseBody?: boolean;
  reportFailedRequests?: boolean;
  ignoreUrls?: Array<string | RegExp>;
  getDeviceContext?: () => DeviceContext;
  enableScreenProfiling?: boolean;
  reportFpsDrops?: boolean;
  fpsSampleWindowMs?: number;
  minimumFps?: number;
  slowFrameThresholdMs?: number;
  slowFramePercentageThreshold?: number;
  fpsReportCooldownMs?: number;
}

export type DidbanInitOptions = DidbanCoreInitOptions<DidbanReactNativeConfig>;

export interface ScreenPerformanceMetrics {
  route: string;
  durationMs: number;
  frameCount: number;
  droppedFrames: number;
  slowFrames: number;
  averageFps: number;
  slowFramePercentage: number;
  worstFrameMs: number;
}
