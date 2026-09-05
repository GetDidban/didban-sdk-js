import type { ResolvedReactNativeConfig } from './config';
import type { ScreenPerformanceMetrics } from './types';

const TARGET_FRAME_MS = 1_000 / 60;
const BACKGROUND_GAP_MS = 1_000;
const MINIMUM_FRAME_SAMPLES = 10;

interface FrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export class ScreenProfiler {
  readonly #config: ResolvedReactNativeConfig;
  readonly #onFpsDrop: (metrics: ScreenPerformanceMetrics) => void;
  readonly #scheduler: FrameScheduler | undefined;
  #route: string | undefined;
  #frameHandle: number | undefined;
  #windowStartedAt: number | undefined;
  #lastFrameAt: number | undefined;
  #frameIntervals: number[] = [];
  #lastReportAt = new Map<string, number>();

  constructor(
    config: ResolvedReactNativeConfig,
    onFpsDrop: (metrics: ScreenPerformanceMetrics) => void,
    scheduler: FrameScheduler | undefined = defaultScheduler(),
  ) {
    this.#config = config;
    this.#onFpsDrop = onFpsDrop;
    this.#scheduler = scheduler;
  }

  start(): void {
    if (
      !this.#config.enableScreenProfiling ||
      !this.#scheduler ||
      this.#frameHandle !== undefined
    ) {
      return;
    }
    this.#frameHandle = this.#scheduler.request(this.#onFrame);
  }

  stop(): void {
    if (this.#frameHandle !== undefined) this.#scheduler?.cancel(this.#frameHandle);
    this.#frameHandle = undefined;
    this.#resetWindow();
  }

  setRoute(route: string | undefined): void {
    if (route === this.#route) return;
    this.#evaluateWindow();
    this.#route = route;
    this.#resetWindow();
  }

  snapshot(): ScreenPerformanceMetrics | undefined {
    return this.#buildMetrics();
  }

  readonly #onFrame = (timestamp: number): void => {
    this.#frameHandle = undefined;
    if (this.#route) {
      if (this.#windowStartedAt === undefined) this.#windowStartedAt = timestamp;
      if (this.#lastFrameAt !== undefined) {
        const interval = timestamp - this.#lastFrameAt;
        if (interval > 0 && interval < BACKGROUND_GAP_MS) {
          this.#frameIntervals.push(interval);
        } else if (interval >= BACKGROUND_GAP_MS) {
          this.#resetWindow(timestamp);
        }
      }
      this.#lastFrameAt = timestamp;
      if (timestamp - this.#windowStartedAt >= this.#config.fpsSampleWindowMs) {
        this.#evaluateWindow(timestamp);
        this.#resetWindow(timestamp);
      }
    }
    this.#frameHandle = this.#scheduler?.request(this.#onFrame);
  };

  #evaluateWindow(timestamp = this.#lastFrameAt): void {
    const metrics = this.#buildMetrics();
    if (!metrics || !this.#config.reportFpsDrops) return;
    const degraded =
      metrics.averageFps < this.#config.minimumFps ||
      metrics.slowFramePercentage >= this.#config.slowFramePercentageThreshold;
    if (!degraded) return;
    const now = timestamp ?? 0;
    const lastReport = this.#lastReportAt.get(metrics.route) ?? Number.NEGATIVE_INFINITY;
    if (now - lastReport < this.#config.fpsReportCooldownMs) return;
    this.#lastReportAt.set(metrics.route, now);
    this.#onFpsDrop(metrics);
  }

  #buildMetrics(): ScreenPerformanceMetrics | undefined {
    if (!this.#route || this.#frameIntervals.length < MINIMUM_FRAME_SAMPLES) return undefined;
    const durationMs = this.#frameIntervals.reduce((sum, interval) => sum + interval, 0);
    if (durationMs <= 0) return undefined;
    const slowFrames = this.#frameIntervals.filter(
      (interval) => interval > this.#config.slowFrameThresholdMs,
    ).length;
    const droppedFrames = this.#frameIntervals.reduce(
      (sum, interval) => sum + Math.max(0, Math.round(interval / TARGET_FRAME_MS) - 1),
      0,
    );
    const frameCount = this.#frameIntervals.length;
    return {
      route: this.#route,
      durationMs: Math.round(durationMs),
      frameCount,
      droppedFrames,
      slowFrames,
      averageFps: round((frameCount / durationMs) * 1_000),
      slowFramePercentage: round((slowFrames / frameCount) * 100),
      worstFrameMs: round(Math.max(...this.#frameIntervals)),
    };
  }

  #resetWindow(timestamp?: number): void {
    this.#windowStartedAt = timestamp;
    this.#lastFrameAt = timestamp;
    this.#frameIntervals = [];
  }
}

function defaultScheduler(): FrameScheduler | undefined {
  if (typeof requestAnimationFrame !== 'function' || typeof cancelAnimationFrame !== 'function') {
    return undefined;
  }
  return {
    request: (callback) => requestAnimationFrame(callback),
    cancel: (handle) => cancelAnimationFrame(handle),
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
