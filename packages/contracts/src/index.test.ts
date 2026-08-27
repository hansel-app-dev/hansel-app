import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './index.js';

describe('healthResponseSchema [REQ-002]', () => {
  it('accepts the specified health response', () => {
    expect(healthResponseSchema.parse({ status: 'ok' })).toEqual({
      status: 'ok',
    });
  });

  it('rejects values outside the contract', () => {
    expect(() => healthResponseSchema.parse({ status: 'down' })).toThrow();
  });
});
