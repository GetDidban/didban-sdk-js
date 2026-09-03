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
}

export type DidbanInitOptions = DidbanCoreInitOptions<DidbanReactNativeConfig>;
