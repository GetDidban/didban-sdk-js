const DEFAULT_HTTP_ERROR_DEDUPLICATION_WINDOW_MS = 2_000;

interface HttpErrorSignature {
  method?: string;
  url: string;
  status?: number;
  expiresAt: number;
}

export class RecentHttpErrorTracker {
  readonly #windowMs: number;
  #recent: HttpErrorSignature[] = [];

  constructor(windowMs = DEFAULT_HTTP_ERROR_DEDUPLICATION_WINDOW_MS) {
    this.#windowMs = Math.max(0, windowMs);
  }

  remember(data: Record<string, unknown>): void {
    const signature = signatureFromHttpData(data);
    if (!signature) return;
    const timestamp = Date.now();
    this.#prune(timestamp);
    this.#recent.push({ ...signature, expiresAt: timestamp + this.#windowMs });
  }

  matches(error: unknown): boolean {
    const signature = signatureFromError(error);
    if (!signature) return false;
    this.#prune(Date.now());
    return this.#recent.some((candidate) => signaturesMatch(candidate, signature));
  }

  clear(): void {
    this.#recent = [];
  }

  #prune(timestamp: number): void {
    this.#recent = this.#recent.filter((item) => item.expiresAt >= timestamp);
  }
}

function signatureFromHttpData(
  data: Record<string, unknown>,
): Omit<HttpErrorSignature, 'expiresAt'> | undefined {
  const url = normalizeUrl(data.url);
  if (!url) return undefined;
  const method = normalizeMethod(data.method);
  const status = normalizeStatus(data.status);
  return {
    url,
    ...(method ? { method } : {}),
    ...(status !== undefined ? { status } : {}),
  };
}

function signatureFromError(error: unknown): Omit<HttpErrorSignature, 'expiresAt'> | undefined {
  const root = asRecord(error);
  if (!root) return undefined;
  const config = asRecord(root.config);
  const response = asRecord(root.response);
  const request = asRecord(root.request);
  const baseUrl = stringValue(config?.baseURL);
  const configuredUrl = stringValue(config?.url);
  const responseUrl = stringValue(request?.responseURL) ?? stringValue(response?.url);
  const url = normalizeUrl(configuredUrl, baseUrl) ?? normalizeUrl(responseUrl);
  if (!url) return undefined;

  const method = normalizeMethod(config?.method ?? request?.method);
  const status = normalizeStatus(root.status ?? response?.status ?? request?.status);
  return {
    url,
    ...(method ? { method } : {}),
    ...(status !== undefined ? { status } : {}),
  };
}

function signaturesMatch(
  recent: Omit<HttpErrorSignature, 'expiresAt'>,
  incoming: Omit<HttpErrorSignature, 'expiresAt'>,
): boolean {
  return (
    recent.url === incoming.url &&
    (!recent.method || !incoming.method || recent.method === incoming.method) &&
    (recent.status === undefined ||
      incoming.status === undefined ||
      recent.status === incoming.status)
  );
}

function normalizeUrl(value: unknown, baseUrl?: string): string | undefined {
  const url = stringValue(value);
  if (!url) return undefined;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

function normalizeMethod(value: unknown): string | undefined {
  const method = stringValue(value);
  return method?.toUpperCase();
}

function normalizeStatus(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
