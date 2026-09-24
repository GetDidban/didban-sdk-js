import { resolveCoreConfig, type ResolvedCoreConfig } from '@didban/core';
import type { DidbanNodeConfig } from './types';

export const DEFAULT_NODE_CONFIG = {
  captureUncaughtErrors: true,
  captureUnhandledRejections: true,
  captureProcessWarnings: false,
  captureFetch: true,
  reportFailedRequests: true,
  reportSlowRequests: true,
  reportSlowOperations: true,
  slowRequestThresholdMs: 3_000,
  slowOperationThresholdMs: 1_000,
  monitorEventLoop: true,
  eventLoopLagThresholdMs: 200,
  eventLoopCheckIntervalMs: 1_000,
  eventLoopReportCooldownMs: 60_000,
  captureHeaders: false,
  ignoreUrls: [],
} as const;

export interface ResolvedNodeConfig extends ResolvedCoreConfig {
  captureUncaughtErrors: boolean;
  captureUnhandledRejections: boolean;
  captureProcessWarnings: boolean;
  captureFetch: boolean;
  reportFailedRequests: boolean;
  reportSlowRequests: boolean;
  reportSlowOperations: boolean;
  slowRequestThresholdMs: number;
  slowOperationThresholdMs: number;
  monitorEventLoop: boolean;
  eventLoopLagThresholdMs: number;
  eventLoopCheckIntervalMs: number;
  eventLoopReportCooldownMs: number;
  captureHeaders: boolean;
  ignoreUrls: Array<string | RegExp>;
}

export function resolveNodeConfig(config: DidbanNodeConfig = {}): ResolvedNodeConfig {
  const number = (value: number | undefined, fallback: number) => Math.max(0, value ?? fallback);
  return {
    ...resolveCoreConfig(config),
    captureUncaughtErrors:
      config.captureUncaughtErrors ?? DEFAULT_NODE_CONFIG.captureUncaughtErrors,
    captureUnhandledRejections:
      config.captureUnhandledRejections ?? DEFAULT_NODE_CONFIG.captureUnhandledRejections,
    captureProcessWarnings:
      config.captureProcessWarnings ?? DEFAULT_NODE_CONFIG.captureProcessWarnings,
    captureFetch: config.captureFetch ?? DEFAULT_NODE_CONFIG.captureFetch,
    reportFailedRequests: config.reportFailedRequests ?? DEFAULT_NODE_CONFIG.reportFailedRequests,
    reportSlowRequests: config.reportSlowRequests ?? DEFAULT_NODE_CONFIG.reportSlowRequests,
    reportSlowOperations: config.reportSlowOperations ?? DEFAULT_NODE_CONFIG.reportSlowOperations,
    slowRequestThresholdMs: number(
      config.slowRequestThresholdMs,
      DEFAULT_NODE_CONFIG.slowRequestThresholdMs,
    ),
    slowOperationThresholdMs: number(
      config.slowOperationThresholdMs,
      DEFAULT_NODE_CONFIG.slowOperationThresholdMs,
    ),
    monitorEventLoop: config.monitorEventLoop ?? DEFAULT_NODE_CONFIG.monitorEventLoop,
    eventLoopLagThresholdMs: number(
      config.eventLoopLagThresholdMs,
      DEFAULT_NODE_CONFIG.eventLoopLagThresholdMs,
    ),
    eventLoopCheckIntervalMs: Math.max(
      10,
      number(config.eventLoopCheckIntervalMs, DEFAULT_NODE_CONFIG.eventLoopCheckIntervalMs),
    ),
    eventLoopReportCooldownMs: number(
      config.eventLoopReportCooldownMs,
      DEFAULT_NODE_CONFIG.eventLoopReportCooldownMs,
    ),
    captureHeaders: config.captureHeaders ?? DEFAULT_NODE_CONFIG.captureHeaders,
    ignoreUrls: [...(config.ignoreUrls ?? DEFAULT_NODE_CONFIG.ignoreUrls)],
  };
}
