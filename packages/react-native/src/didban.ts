import type {
  Breadcrumb,
  BreadcrumbCategory,
  CaptureContext,
  DidbanUser,
  DidbanReport,
  LogLevel,
} from '@didban/core';
import { DidbanReactNativeClient } from './client';
import type { DidbanInitOptions, ScreenPerformanceMetrics } from './types';

export class Didban {
  static #client: DidbanReactNativeClient | undefined;

  static init(options: DidbanInitOptions): DidbanReactNativeClient {
    this.#client?.destroy();
    this.#client = new DidbanReactNativeClient(options).start();
    return this.#client;
  }

  static capture(input: unknown, context?: CaptureContext): Promise<boolean> {
    return this.#requireClient().capture(input, context);
  }

  static log(
    message: string,
    data?: Record<string, unknown>,
    level: LogLevel = 'info',
  ): Breadcrumb {
    return this.#requireClient().log(message, data, level);
  }

  static addClue(
    message: string,
    data?: Record<string, unknown>,
    category: BreadcrumbCategory = 'custom',
  ): Breadcrumb {
    return this.#requireClient().addClue(message, data, category);
  }

  static addBreadcrumb(message: string, data?: Record<string, unknown>): Breadcrumb {
    return this.#requireClient().addBreadcrumb(message, data);
  }

  static setCurrentRoute(route: string | undefined, params?: Record<string, unknown>): void {
    this.#requireClient().setCurrentRoute(route, params);
  }

  static getScreenPerformance(): ScreenPerformanceMetrics | undefined {
    return this.#requireClient().getScreenPerformance();
  }

  static set userData(user: DidbanUser | undefined) {
    this.#requireClient().userData = user;
  }

  static get userData(): DidbanUser | undefined {
    return this.#client?.userData;
  }

  static setUser(user: DidbanUser | undefined): void {
    this.#requireClient().setUser(user);
  }

  static getBreadcrumbs(): Breadcrumb[] {
    return this.#requireClient().getBreadcrumbs();
  }

  static clearBreadcrumbs(): void {
    this.#requireClient().clearBreadcrumbs();
  }

  static getStoredErrors(): Promise<DidbanReport[]> {
    return this.#requireClient().getStoredErrors();
  }

  static clearStoredErrors(): Promise<void> {
    return this.#requireClient().clearStoredErrors();
  }

  static destroy(): void {
    this.#client?.destroy();
    this.#client = undefined;
  }

  static #requireClient(): DidbanReactNativeClient {
    if (!this.#client) {
      throw new Error('Call Didban.init({ apiKey, appName, config }) before using the SDK');
    }
    return this.#client;
  }
}
