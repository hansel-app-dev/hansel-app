import { describe, expect, it } from 'vitest';
import { selectCatalogEnvironment } from './catalog-environment.js';
import { loadPlanCatalog } from './plan-catalog.js';

describe('sandbox-test-catalog REQ-001,002,003', () => {
  it('allows the approved sandbox catalog without changing production runtime settings', () => {
    const runtime = 'production';
    const environment = selectCatalogEnvironment(
      runtime,
      'sandbox',
      'https://203.0.113.1',
    );
    expect(loadPlanCatalog(environment).dummy).toBe(true);
    expect(runtime).toBe('production');
  });
  it('preserves absent-marker behavior and explicit production validation', () => {
    expect(
      selectCatalogEnvironment('test', undefined, 'http://localhost:5173'),
    ).toBe('test');
    for (const marker of [undefined, 'production']) {
      const environment = selectCatalogEnvironment(
        'production',
        marker,
        'https://app.hanselapp.io',
      );
      expect(() => loadPlanCatalog(environment)).toThrow('Dummy plan catalog');
      expect(() =>
        loadPlanCatalog(environment, {
          ...loadPlanCatalog('test'),
          dummy: false,
        }),
      ).toThrow('Stripe test lookup');
    }
    expect(
      selectCatalogEnvironment(
        'test',
        'production',
        'https://app.hanselapp.io',
      ),
    ).toBe('production');
  });
  it.each(['', 'staging', 'Sandbox'])('rejects unknown marker %s', (marker) => {
    expect(() =>
      selectCatalogEnvironment('production', marker, 'https://203.0.113.1'),
    ).toThrow();
  });
  it.each([
    'invalid',
    'http://203.0.113.1',
    'https://app.hanselapp.io',
    'https://203.0.113.1:444',
    'https://user@203.0.113.1',
    'https://user:password@203.0.113.1',
    'https://203.0.113.1/path',
    'https://203.0.113.1?x=1',
    'https://203.0.113.1#x',
  ])('rejects invalid sandbox origin %s', (origin) => {
    expect(() =>
      selectCatalogEnvironment('production', 'sandbox', origin),
    ).toThrow();
  });
});
