import type { DidbanCoreConfig } from './types';

export const MAX_BREADCRUMBS_LIMIT = 30;

export const DEFAULT_CORE_CONFIG = {
  baseUrl: 'https://api.didban.dev',
  reportPath: '/api/v1/events',
  maxBreadcrumbs: MAX_BREADCRUMBS_LIMIT,
  maxValueLength: 2_000,
} as const;

export interface ResolvedCoreConfig {
  baseUrl: string;
  reportPath: string;
  environment?: string;
  release?: string;
  maxBreadcrumbs: number;
  maxValueLength: number;
  beforeSend?: DidbanCoreConfig['beforeSend'];
  onError?: DidbanCoreConfig['onError'];
}

export function resolveCoreConfig(config: DidbanCoreConfig = {}): ResolvedCoreConfig {
  const maxBreadcrumbs = Number.isFinite(config.maxBreadcrumbs)
    ? Math.max(1, Math.min(MAX_BREADCRUMBS_LIMIT, Math.floor(config.maxBreadcrumbs!)))
    : DEFAULT_CORE_CONFIG.maxBreadcrumbs;

  return {
    baseUrl: config.baseUrl ?? DEFAULT_CORE_CONFIG.baseUrl,
    reportPath: config.reportPath ?? DEFAULT_CORE_CONFIG.reportPath,
    ...(config.environment ? { environment: config.environment } : {}),
    ...(config.release ? { release: config.release } : {}),
    maxBreadcrumbs,
    maxValueLength: Math.max(100, config.maxValueLength ?? DEFAULT_CORE_CONFIG.maxValueLength),
    ...(config.beforeSend ? { beforeSend: config.beforeSend } : {}),
    ...(config.onError ? { onError: config.onError } : {}),
  };
}
