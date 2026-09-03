import type { Breadcrumb } from './types';

export class BreadcrumbBuffer {
  readonly #capacity: number;
  #items: Breadcrumb[] = [];

  constructor(capacity: number) {
    this.#capacity = Math.max(1, Math.min(30, Math.floor(capacity)));
  }

  add(item: Breadcrumb): void {
    this.#items.push(item);
    if (this.#items.length > this.#capacity) {
      this.#items.splice(0, this.#items.length - this.#capacity);
    }
  }

  snapshot(): Breadcrumb[] {
    return this.#items.map((item) => ({
      ...item,
      ...(item.data ? { data: { ...item.data } } : {}),
    }));
  }

  clear(): void {
    this.#items = [];
  }

  get size(): number {
    return this.#items.length;
  }
}
