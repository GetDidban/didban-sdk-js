export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

export type BreadcrumbCategory =
  | 'user.click'
  | 'user.input'
  | 'navigation'
  | 'http'
  | 'log'
  | 'custom'
  | 'error';

export interface Breadcrumb {
  id: string;
  category: BreadcrumbCategory;
  message: string;
  timestamp: string;
  level: LogLevel;
  data?: Record<string, unknown>;
}

export interface DidbanUser {
  id?: string;
  email?: string;
  username?: string;
  [key: string]: unknown;
}

export interface CaptureContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  level?: LogLevel;
}

export interface PageContext {
  url?: string;
  title?: string;
  referrer?: string;
  route?: string;
}

export interface DeviceContext {
  userAgent?: string;
  language?: string;
  platform?: string;
  osVersion?: string | number;
  viewport?: { width: number; height: number };
  [key: string]: unknown;
}

export interface DidbanReport {
  eventId: string;
  appName: string;
  timestamp: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  context?: CaptureContext;
  user?: DidbanUser;
  breadcrumbs: Breadcrumb[];
  page: PageContext;
  device: DeviceContext;
  sdk: { name: string; version: string };
  environment?: string;
  release?: string;
}

export interface DidbanCoreConfig {
  /** API origin, for example https://api.example.com */
  baseUrl?: string;
  /** Override the report endpoint path. */
  reportPath?: string;
  environment?: string;
  release?: string;
  maxBreadcrumbs?: number;
  maxValueLength?: number;
  beforeSend?: (report: DidbanReport) => DidbanReport | null | Promise<DidbanReport | null>;
  onError?: (error: Error) => void;
}

export interface DidbanCoreInitOptions<TConfig extends DidbanCoreConfig = DidbanCoreConfig> {
  apiKey: string;
  appName: string;
  config?: TConfig;
}
