import { describe, it, expect } from 'vitest';
import { clampSpan, spanFromDelta, MAX_SPAN, RESIZE_STEP_PX } from '../src/lib/layout';

describe('clampSpan', () => {
  it('floors at 1', () => { expect(clampSpan(0)).toBe(1); expect(clampSpan(-3)).toBe(1); });
  it('caps at MAX_SPAN', () => { expect(clampSpan(99)).toBe(MAX_SPAN); });
  it('rounds to the nearest cell', () => { expect(clampSpan(2.4)).toBe(2); expect(clampSpan(2.6)).toBe(3); });
  it('honors a custom max', () => { expect(clampSpan(5, 2)).toBe(2); });
});

describe('spanFromDelta', () => {
  it('grows one span per RESIZE_STEP_PX of positive drag', () => {
    expect(spanFromDelta(1, RESIZE_STEP_PX)).toBe(2);
    expect(spanFromDelta(1, RESIZE_STEP_PX * 2)).toBe(3);
  });
  it('shrinks on negative drag but never below 1', () => {
    expect(spanFromDelta(3, -RESIZE_STEP_PX)).toBe(2);
    expect(spanFromDelta(1, -RESIZE_STEP_PX * 5)).toBe(1);
  });
  it('caps at MAX_SPAN', () => {
    expect(spanFromDelta(1, RESIZE_STEP_PX * 99)).toBe(MAX_SPAN);
  });
});
