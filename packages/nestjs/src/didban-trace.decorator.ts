import { SetMetadata } from '@nestjs/common';
import { DIDBAN_TRACE_METADATA } from './constants';
import type { DidbanTraceMetadata } from './types';

export function DidbanTrace(
  nameOrOptions?: string | DidbanTraceMetadata,
  options: Omit<DidbanTraceMetadata, 'name'> = {},
): MethodDecorator {
  const metadata: DidbanTraceMetadata =
    typeof nameOrOptions === 'string'
      ? { ...options, name: nameOrOptions }
      : { ...(nameOrOptions ?? {}) };
  return SetMetadata(DIDBAN_TRACE_METADATA, metadata);
}
