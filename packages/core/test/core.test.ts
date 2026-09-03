import { describe, expect, it } from 'vitest';
import { BreadcrumbBuffer, sanitize } from '../src';

describe('Didban core', () => {
  it('keeps only the latest 30 breadcrumbs', () => {
    const buffer = new BreadcrumbBuffer(100);
    for (let index = 0; index < 35; index += 1) {
      buffer.add({
        id: String(index),
        category: 'custom',
        message: `item-${index}`,
        timestamp: new Date().toISOString(),
        level: 'info',
      });
    }
    expect(buffer.size).toBe(30);
    expect(buffer.snapshot()[0]?.message).toBe('item-5');
  });

  it('sanitizes secrets and circular values in every platform', () => {
    const value: Record<string, unknown> = { token: 'secret', profile: { name: 'Ada' } };
    value.self = value;
    expect(sanitize(value, 2_000)).toEqual({
      token: '[Filtered]',
      profile: { name: 'Ada' },
      self: '[Circular]',
    });
  });
});
