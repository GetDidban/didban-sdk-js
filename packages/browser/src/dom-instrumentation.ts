import { createId, sanitize, truncate, type Breadcrumb } from '@didban/core';
import type { ResolvedBrowserConfig } from './config';
import { elementSelector } from './utils';

export class DomInstrumentation {
  readonly #config: ResolvedBrowserConfig;
  readonly #add: (breadcrumb: Breadcrumb) => void;
  #started = false;

  constructor(config: ResolvedBrowserConfig, add: (breadcrumb: Breadcrumb) => void) {
    this.#config = config;
    this.#add = add;
  }

  start(): void {
    if (this.#started || typeof document === 'undefined') return;
    if (this.#config.captureClicks) document.addEventListener('click', this.#onClick, true);
    if (this.#config.captureInputs) document.addEventListener('input', this.#onInput, true);
    this.#started = true;
  }

  stop(): void {
    if (!this.#started || typeof document === 'undefined') return;
    document.removeEventListener('click', this.#onClick, true);
    document.removeEventListener('input', this.#onInput, true);
    this.#started = false;
  }

  readonly #onClick = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const clickable = target.closest('button, a, input, select, textarea, [role=button]') ?? target;
    this.#add({
      id: createId(),
      category: 'user.click',
      message: `Clicked ${elementSelector(clickable)}`,
      timestamp: new Date().toISOString(),
      level: 'info',
      data: {
        selector: elementSelector(clickable),
        text: truncate((clickable.textContent ?? '').trim(), 120),
        tag: clickable.tagName.toLowerCase(),
      },
    });
  };

  readonly #onInput = (event: Event): void => {
    const target = event.target;
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
    ) {
      return;
    }
    const masked =
      this.#config.maskAllInputs ||
      this.#config.maskSelectors.some((selector) => {
        try {
          return target.matches(selector);
        } catch {
          return false;
        }
      });
    const value = masked ? '[Masked]' : sanitize(target.value, this.#config.maxValueLength);
    this.#add({
      id: createId(),
      category: 'user.input',
      message: `Changed ${elementSelector(target)}`,
      timestamp: new Date().toISOString(),
      level: 'info',
      data: {
        selector: elementSelector(target),
        inputType: target instanceof HTMLInputElement ? target.type : target.tagName.toLowerCase(),
        value,
      },
    });
  };
}
