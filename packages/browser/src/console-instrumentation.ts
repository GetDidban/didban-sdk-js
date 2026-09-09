export type ConsoleErrorHandler = (error: Error) => unknown | Promise<unknown>;

export class ConsoleInstrumentation {
  readonly #onError: ConsoleErrorHandler;
  #originalError: typeof console.error | undefined;
  #wrappedError: typeof console.error | undefined;
  #capturePending = false;

  constructor(onError: ConsoleErrorHandler) {
    this.#onError = onError;
  }

  start(): void {
    if (
      this.#wrappedError ||
      typeof console === 'undefined' ||
      typeof console.error !== 'function'
    ) {
      return;
    }

    const originalError = console.error;
    const onError = this.#onError;
    const wrappedError = (...args: unknown[]): void => {
      originalError.apply(console, args);
      const error = findError(args);
      if (!error || this.#capturePending) return;

      this.#capturePending = true;
      void Promise.resolve(onError(error))
        .catch(() => undefined)
        .finally(() => {
          this.#capturePending = false;
        });
    };

    this.#originalError = originalError;
    this.#wrappedError = wrappedError;
    console.error = wrappedError;
  }

  stop(): void {
    if (this.#wrappedError && console.error === this.#wrappedError && this.#originalError) {
      console.error = this.#originalError;
    }
    this.#originalError = undefined;
    this.#wrappedError = undefined;
    this.#capturePending = false;
  }
}

function findError(args: unknown[]): Error | undefined {
  for (const value of args) {
    if (value instanceof Error) return value;

    if (isErrorLike(value)) {
      const error = new Error(value.message);
      error.name = typeof value.name === 'string' ? value.name : 'Error';
      if (typeof value.stack === 'string') error.stack = value.stack;
      return error;
    }
  }
  return undefined;
}

function isErrorLike(value: unknown): value is { message: string; name?: string; stack?: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { message?: unknown }).message === 'string' &&
    typeof (value as { stack?: unknown }).stack === 'string'
  );
}
