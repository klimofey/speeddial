import { describe, it, expect } from 'vitest';
import { greeting } from '../src/components/Clock';

describe('greeting', () => {
  it('returns morning key before noon', () => { expect(greeting(9)).toBe('greeting_morning'); });
  it('returns afternoon key', () => { expect(greeting(14)).toBe('greeting_afternoon'); });
  it('returns evening key', () => { expect(greeting(20)).toBe('greeting_evening'); });
});
