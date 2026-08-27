import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig [REQ-002]', () => {
  it('uses safe local defaults', () => {
    expect(loadConfig({})).toEqual({
      allowedOrigin: 'http://localhost:5173',
      port: 3000,
    });
  });

  it('reads valid environment values', () => {
    expect(
      loadConfig({ PORT: '8080', ALLOWED_ORIGIN: 'https://hansel.example' }),
    ).toEqual({
      allowedOrigin: 'https://hansel.example',
      port: 8080,
    });
  });

  it.each(['0', '65536', '1.5', 'invalid'])(
    'rejects invalid port %s',
    (port) => {
      expect(() => loadConfig({ PORT: port })).toThrow(
        'PORT must be an integer',
      );
    },
  );
});
