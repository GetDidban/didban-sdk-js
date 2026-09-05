import { describe, expect, it, vi } from 'vitest';
import { resolveReactNativeConfig } from '../src/config';
import { ScreenProfiler } from '../src/screen-profiler';

describe('ScreenProfiler', () => {
  it('detects a slow route and reports its frame metrics', () => {
    let nextFrame: FrameRequestCallback | undefined;
    const scheduler = {
      request: vi.fn((callback: FrameRequestCallback) => {
        nextFrame = callback;
        return 1;
      }),
      cancel: vi.fn(),
    };
    const onFpsDrop = vi.fn();
    const profiler = new ScreenProfiler(
      resolveReactNativeConfig({
        fpsSampleWindowMs: 1_000,
        minimumFps: 50,
        slowFrameThresholdMs: 32,
        fpsReportCooldownMs: 0,
      }),
      onFpsDrop,
      scheduler,
    );

    profiler.setRoute('ProductList');
    profiler.start();
    for (let timestamp = 0; timestamp <= 1_040; timestamp += 40) {
      const callback = nextFrame;
      expect(callback).toBeTypeOf('function');
      callback!(timestamp);
    }

    expect(onFpsDrop).toHaveBeenCalledOnce();
    expect(onFpsDrop).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'ProductList',
        averageFps: 25,
        slowFramePercentage: 100,
        worstFrameMs: 40,
      }),
    );
  });

  it('does not report a healthy route', () => {
    let nextFrame: FrameRequestCallback | undefined;
    const scheduler = {
      request(callback: FrameRequestCallback) {
        nextFrame = callback;
        return 1;
      },
      cancel: vi.fn(),
    };
    const onFpsDrop = vi.fn();
    const profiler = new ScreenProfiler(
      resolveReactNativeConfig({ fpsSampleWindowMs: 1_000, fpsReportCooldownMs: 0 }),
      onFpsDrop,
      scheduler,
    );

    profiler.setRoute('Home');
    profiler.start();
    for (let timestamp = 0; timestamp <= 1_008; timestamp += 16) nextFrame!(timestamp);

    expect(onFpsDrop).not.toHaveBeenCalled();
  });
});
