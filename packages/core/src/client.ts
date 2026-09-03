import { DidbanApiClient } from './api';
import { BreadcrumbBuffer } from './breadcrumb-buffer';
import type { ResolvedCoreConfig } from './config';
import type {
  Breadcrumb,
  BreadcrumbCategory,
  CaptureContext,
  DeviceContext,
  DidbanReport,
  DidbanUser,
  LogLevel,
  PageContext,
} from './types';
import { createId, normalizeError, sanitize } from './utils';

export interface DidbanCoreClientOptions {
  apiKey: string;
  appName: string;
  config: ResolvedCoreConfig;
  sdk: { name: string; version: string };
  getPageContext?: () => PageContext;
  getDeviceContext?: () => DeviceContext;
}

export class DidbanCoreClient {
  readonly #appName: string;
  readonly #api: DidbanApiClient;
  readonly #breadcrumbs: BreadcrumbBuffer;
  readonly #sdk: { name: string; version: string };
  readonly #getPageContext: () => PageContext;
  readonly #getDeviceContext: () => DeviceContext;
  protected readonly config: ResolvedCoreConfig;
  #userData: DidbanUser | undefined;

  constructor(options: DidbanCoreClientOptions) {
    if (!options || typeof options.apiKey !== 'string' || !options.apiKey.trim()) {
      throw new TypeError('Didban.init requires a non-empty apiKey');
    }
    if (typeof options.appName !== 'string' || !options.appName.trim()) {
      throw new TypeError('Didban.init requires a non-empty appName');
    }
    this.#appName = options.appName.trim().slice(0, 160);
    this.config = options.config;
    this.#breadcrumbs = new BreadcrumbBuffer(this.config.maxBreadcrumbs);
    this.#api = new DidbanApiClient({
      apiKey: options.apiKey,
      baseUrl: this.config.baseUrl,
      reportPath: this.config.reportPath,
    });
    this.#sdk = options.sdk;
    this.#getPageContext = options.getPageContext ?? (() => ({}));
    this.#getDeviceContext = options.getDeviceContext ?? (() => ({}));
  }

  get reportUrl(): string {
    return this.#api.reportUrl;
  }

  set userData(user: DidbanUser | undefined) {
    this.#userData = user ? (sanitize(user, this.config.maxValueLength) as DidbanUser) : undefined;
  }

  get userData(): DidbanUser | undefined {
    return this.#userData ? { ...this.#userData } : undefined;
  }

  setUser(user: DidbanUser | undefined): this {
    this.userData = user;
    return this;
  }

  addClue(
    message: string,
    data?: Record<string, unknown>,
    category: BreadcrumbCategory = 'custom',
    level: LogLevel = 'info',
  ): Breadcrumb {
    const breadcrumb: Breadcrumb = {
      id: createId(),
      category,
      message,
      timestamp: new Date().toISOString(),
      level,
      ...(data
        ? { data: sanitize(data, this.config.maxValueLength) as Record<string, unknown> }
        : {}),
    };
    this.#breadcrumbs.add(breadcrumb);
    return breadcrumb;
  }

  addBreadcrumb(message: string, data?: Record<string, unknown>): Breadcrumb {
    return this.addClue(message, data);
  }

  log(message: string, data?: Record<string, unknown>, level: LogLevel = 'info'): Breadcrumb {
    return this.addClue(message, data, 'log', level);
  }

  async capture(input: unknown, context?: CaptureContext): Promise<boolean> {
    const error = normalizeError(input);
    this.addClue(error.message, { name: error.name }, 'error', context?.level ?? 'error');
    let report = this.#createReport(error, context);
    try {
      if (this.config.beforeSend) {
        const processed = await this.config.beforeSend(report);
        if (!processed) return false;
        report = processed;
      }
      await this.#api.sendReport(report);
      return true;
    } catch (cause) {
      this.config.onError?.(normalizeError(cause));
      return false;
    }
  }

  getBreadcrumbs(): Breadcrumb[] {
    return this.#breadcrumbs.snapshot();
  }

  clearBreadcrumbs(): void {
    this.#breadcrumbs.clear();
  }

  #createReport(error: Error, context?: CaptureContext): DidbanReport {
    return {
      eventId: createId(),
      appName: this.#appName,
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        ...(error.stack ? { stack: error.stack } : {}),
      },
      ...(context
        ? { context: sanitize(context, this.config.maxValueLength) as CaptureContext }
        : {}),
      ...(this.#userData ? { user: { ...this.#userData } } : {}),
      breadcrumbs: this.#breadcrumbs.snapshot(),
      page: this.#getPageContext(),
      device: this.#getDeviceContext(),
      sdk: { ...this.#sdk },
      ...(this.config.environment ? { environment: this.config.environment } : {}),
      ...(this.config.release ? { release: this.config.release } : {}),
    };
  }
}
