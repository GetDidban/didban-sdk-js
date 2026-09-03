type GlobalErrorHandler = (error: Error, isFatal?: boolean) => void;

interface ErrorUtilsLike {
  getGlobalHandler?: () => GlobalErrorHandler;
  setGlobalHandler: (handler: GlobalErrorHandler) => void;
}

interface RejectionEventLike {
  reason?: unknown;
}

interface ReactNativeRuntime {
  ErrorUtils?: ErrorUtilsLike;
  addEventListener?: (type: string, listener: (event: RejectionEventLike) => void) => void;
  removeEventListener?: (type: string, listener: (event: RejectionEventLike) => void) => void;
}

export class ReactNativeErrorInstrumentation {
  readonly #capture: (error: unknown, data: Record<string, unknown>) => void;
  readonly #captureAppErrors: boolean;
  readonly #captureUnhandledRejections: boolean;
  #previousHandler: GlobalErrorHandler | undefined;
  #installedHandler: GlobalErrorHandler | undefined;
  #rejectionListening = false;

  constructor(
    captureAppErrors: boolean,
    captureUnhandledRejections: boolean,
    capture: (error: unknown, data: Record<string, unknown>) => void,
  ) {
    this.#captureAppErrors = captureAppErrors;
    this.#captureUnhandledRejections = captureUnhandledRejections;
    this.#capture = capture;
  }

  start(): void {
    const runtime = globalThis as ReactNativeRuntime;
    if (this.#captureAppErrors && runtime.ErrorUtils && !this.#installedHandler) {
      this.#previousHandler = runtime.ErrorUtils.getGlobalHandler?.();
      const previous = this.#previousHandler;
      this.#installedHandler = (error, isFatal) => {
        this.#capture(error, { source: 'react-native', isFatal: Boolean(isFatal) });
        previous?.(error, isFatal);
      };
      runtime.ErrorUtils.setGlobalHandler(this.#installedHandler);
    }
    if (this.#captureUnhandledRejections && runtime.addEventListener) {
      runtime.addEventListener('unhandledrejection', this.#onUnhandledRejection);
      this.#rejectionListening = true;
    }
  }

  stop(): void {
    const runtime = globalThis as ReactNativeRuntime;
    if (this.#installedHandler && runtime.ErrorUtils && this.#previousHandler) {
      runtime.ErrorUtils.setGlobalHandler(this.#previousHandler);
    }
    if (this.#rejectionListening && runtime.removeEventListener) {
      runtime.removeEventListener('unhandledrejection', this.#onUnhandledRejection);
    }
    this.#previousHandler = undefined;
    this.#installedHandler = undefined;
    this.#rejectionListening = false;
  }

  readonly #onUnhandledRejection = (event: RejectionEventLike): void => {
    this.#capture(event.reason, { source: 'unhandledrejection' });
  };
}
