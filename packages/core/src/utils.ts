const SENSITIVE_KEY =
  /password|passwd|secret|token|authorization|api[-_]?key|cookie|credit|card|cvv|cvc/i;

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}…`;
}

export function sanitize(value: unknown, maxLength: number): unknown {
  const seen = new WeakSet<object>();
  const walk = (current: unknown, key = ''): unknown => {
    if (SENSITIVE_KEY.test(key)) return '[Filtered]';
    if (typeof current === 'string') return truncate(current, maxLength);
    if (typeof current === 'bigint') return current.toString();
    if (typeof current === 'function') return `[Function ${current.name || 'anonymous'}]`;
    if (current === undefined || current === null || typeof current !== 'object') return current;
    if (seen.has(current)) return '[Circular]';
    seen.add(current);
    if (current instanceof Error) {
      return {
        name: current.name,
        message: truncate(current.message, maxLength),
        stack: current.stack,
      };
    }
    if (current instanceof Date) return current.toISOString();
    if (typeof URLSearchParams !== 'undefined' && current instanceof URLSearchParams) {
      const result: Record<string, unknown> = {};
      current.forEach((item, itemKey) => {
        result[itemKey] = walk(item, itemKey);
      });
      return result;
    }
    if (typeof FormData !== 'undefined' && current instanceof FormData) {
      const result: Record<string, unknown> = {};
      current.forEach((item, itemKey) => {
        result[itemKey] =
          typeof File !== 'undefined' && item instanceof File
            ? `[File ${item.name}]`
            : walk(item, itemKey);
      });
      return result;
    }
    if (typeof Blob !== 'undefined' && current instanceof Blob) {
      return `[Blob ${current.type || 'unknown'}, ${current.size} bytes]`;
    }
    if (Array.isArray(current)) return current.map((item) => walk(item));
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(current)) {
      result[childKey] = walk(childValue, childKey);
    }
    return result;
  };
  return walk(value);
}

export function sanitizeBody(value: unknown, maxLength: number): unknown {
  if (typeof value !== 'string') return sanitize(value, maxLength);
  try {
    return sanitize(JSON.parse(value), maxLength);
  } catch {
    if (value.includes('=') && typeof URLSearchParams !== 'undefined') {
      try {
        return sanitize(new URLSearchParams(value), maxLength);
      } catch {
        // Fall through to a plain string.
      }
    }
    return truncate(value, maxLength);
  }
}

export function normalizeError(input: unknown): Error {
  if (input instanceof Error) return input;
  if (typeof input === 'string') return new Error(input);
  const serialized = JSON.stringify(sanitize(input, 2_000));
  return new Error(serialized && serialized !== '{}' ? serialized : 'Unknown error');
}

export function shouldIgnoreUrl(url: string, patterns: Array<string | RegExp>): boolean {
  return patterns.some((pattern) =>
    typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url),
  );
}

export function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}
