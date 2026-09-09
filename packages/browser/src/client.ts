import { DidbanCoreClient, type DeviceContext, type PageContext } from '@didban/core';
import { ConsoleInstrumentation } from './console-instrumentation';
import { resolveBrowserConfig, type ResolvedBrowserConfig } from './config';
import { DomInstrumentation } from './dom-instrumentation';
import { NetworkInstrumentation } from './network-instrumentation';
import type { DidbanInitOptions } from './types';

const SDK_NAME = '@didban/browser-sdk';
const SDK_VERSION = '0.1.1';

export class DidbanClient extends DidbanCoreClient {
  readonly #dom: DomInstrumentation;
  readonly #network: NetworkInstrumentation;
  readonly #console: ConsoleInstrumentation;
  readonly #capturedErrors = new WeakSet<object>();
  #started = false;

  constructor(options: DidbanInitOptions) {
    const config = resolveBrowserConfig(options?.config);
    const errorStorage = browserErrorStorage();
    super({
      apiKey: options?.apiKey ?? '',
      appName: options?.appName ?? '',
      config,
      sdk: { name: SDK_NAME, version: SDK_VERSION },
      getPageContext: browserPageContext,
      getDeviceContext: browserDeviceContext,
      ...(errorStorage ? { errorStorage } : {}),
    });
    this.#dom = new DomInstrumentation(config, (breadcrumb) => {
      this.addClue(breadcrumb.message, breadcrumb.data, breadcrumb.category, breadcrumb.level);
    });
    this.#network = new NetworkInstrumentation(config, this.reportUrl, {
      addHttp: (data, level = 'info') => this.addClue('HTTP request', data, 'http', level),
      reportHttpError: (error, data) => {
        void this.capture(error, { extra: { http: data } });
      },
    });
    this.#console = new ConsoleInstrumentation((error) => {
      return this.#captureAutomatic(error, 'console.error');
    });
  }

  start(): this {
    if (this.#started) return this;
    this.#dom.start();
    this.#network.start();
    if (typeof window !== 'undefined') {
      if (this.config.captureConsoleErrors) this.#console.start();
      window.addEventListener('error', this.#onWindowError);
      window.addEventListener('unhandledrejection', this.#onUnhandledRejection);
    }
    this.#started = true;
    return this;
  }

  destroy(): void {
    if (!this.#started) return;
    this.#dom.stop();
    this.#network.stop();
    if (typeof window !== 'undefined') {
      this.#console.stop();
      window.removeEventListener('error', this.#onWindowError);
      window.removeEventListener('unhandledrejection', this.#onUnhandledRejection);
    }
    this.#started = false;
  }

  readonly #onWindowError = (event: ErrorEvent): void => {
    this.#captureAutomatic(event.error ?? new Error(event.message), 'window.error', {
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  };

  readonly #onUnhandledRejection = (event: PromiseRejectionEvent): void => {
    this.#captureAutomatic(event.reason, 'unhandledrejection');
  };

  #captureAutomatic(
    input: unknown,
    source: string,
    extra: Record<string, unknown> = {},
  ): Promise<boolean> | undefined {
    if (typeof input === 'object' && input !== null) {
      if (this.#capturedErrors.has(input)) return;
      this.#capturedErrors.add(input);
    }
    return this.capture(input, { extra: { source, ...extra } });
  }
}

function browserErrorStorage(): Storage | undefined {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined;
  } catch {
    return undefined;
  }
}

function browserPageContext(): PageContext {
  return {
    ...(typeof location !== 'undefined' ? { url: location.href } : {}),
    ...(typeof document !== 'undefined'
      ? { title: document.title, referrer: document.referrer }
      : {}),
  };
}

function browserDeviceContext(): DeviceContext {
  return {
    ...(typeof navigator !== 'undefined'
      ? { userAgent: navigator.userAgent, language: navigator.language }
      : {}),
    ...(typeof window !== 'undefined'
      ? { viewport: { width: window.innerWidth, height: window.innerHeight } }
      : {}),
  };
}
