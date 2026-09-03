import { DidbanCoreClient, type DeviceContext } from '@didban/core';
import { Dimensions, Platform } from 'react-native';
import { resolveReactNativeConfig } from './config';
import { ReactNativeErrorInstrumentation } from './error-instrumentation';
import { ReactNativeNetworkInstrumentation } from './network-instrumentation';
import type { DidbanInitOptions } from './types';

const SDK_NAME = '@didban/react-native';
const SDK_VERSION = '0.1.0';

interface RouteState {
  current?: string;
}

export class DidbanReactNativeClient extends DidbanCoreClient {
  readonly #errors: ReactNativeErrorInstrumentation;
  readonly #network: ReactNativeNetworkInstrumentation;
  readonly #routeState: RouteState;
  #started = false;

  constructor(options: DidbanInitOptions) {
    const config = resolveReactNativeConfig(options?.config);
    const routeState: RouteState = {};
    super({
      apiKey: options?.apiKey ?? '',
      appName: options?.appName ?? '',
      config,
      sdk: { name: SDK_NAME, version: SDK_VERSION },
      getPageContext: () => (routeState.current ? { route: routeState.current } : {}),
      getDeviceContext: () => ({
        ...defaultDeviceContext(),
        ...config.getDeviceContext?.(),
      }),
    });
    this.#routeState = routeState;
    this.#network = new ReactNativeNetworkInstrumentation(config, this.reportUrl, {
      addHttp: (data, level = 'info') => this.addClue('HTTP request', data, 'http', level),
      reportHttpError: (error, data) => {
        void this.capture(error, { extra: { http: data } });
      },
    });
    this.#errors = new ReactNativeErrorInstrumentation(
      config.captureAppErrors,
      config.captureUnhandledRejections,
      (error, data) => {
        void this.capture(error, { extra: data });
      },
    );
  }

  start(): this {
    if (this.#started) return this;
    this.#network.start();
    this.#errors.start();
    this.#started = true;
    return this;
  }

  destroy(): void {
    if (!this.#started) return;
    this.#errors.stop();
    this.#network.stop();
    this.#started = false;
  }

  setCurrentRoute(route: string | undefined, params?: Record<string, unknown>): this {
    const previous = this.#routeState.current;
    if (route) this.#routeState.current = route;
    else delete this.#routeState.current;
    if (route && route !== previous) {
      this.addClue(
        `Navigated to ${route}`,
        { ...(previous ? { from: previous } : {}), to: route, ...(params ? { params } : {}) },
        'navigation',
      );
    }
    return this;
  }
}

function defaultDeviceContext(): DeviceContext {
  const viewport = Dimensions.get('window');
  const reactNativeVersion = Platform.constants?.reactNativeVersion;
  return {
    platform: Platform.OS,
    osVersion: Platform.Version,
    viewport: { width: viewport.width, height: viewport.height },
    ...(reactNativeVersion
      ? {
          reactNativeVersion: `${reactNativeVersion.major}.${reactNativeVersion.minor}.${reactNativeVersion.patch}`,
        }
      : {}),
  };
}
