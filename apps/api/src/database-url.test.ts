import { describe, expect, it } from 'vitest';
import { configureDatabaseUrl } from './database-url.js';

describe('configureDatabaseUrl [onboarding-welcome-email REQ-016]', () => {
  it('preserves an explicit database URL', () => {
    const environment = { DATABASE_URL: 'postgresql://existing/database' };
    expect(configureDatabaseUrl(environment)).toBe(environment.DATABASE_URL);
  });

  it('constructs the private database URL without logging credentials', () => {
    const environment = {
      DB_HOST: 'database.internal',
      DB_PORT: '5432',
      DB_NAME: 'hansel',
      DB_USERNAME: 'user@example.com',
      DB_PASSWORD: 'secret/value',
    };
    expect(configureDatabaseUrl(environment)).toBe(
      'postgresql://user%40example.com:secret%2Fvalue@database.internal:5432/hansel?schema=public',
    );
    expect(environment).toHaveProperty('DATABASE_URL');
  });

  it.each([
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USERNAME',
    'DB_PASSWORD',
  ] as const)('rejects missing %s', (name) => {
    const environment: NodeJS.ProcessEnv = {
      DB_HOST: 'database.internal',
      DB_PORT: '5432',
      DB_NAME: 'hansel',
      DB_USERNAME: 'hansel',
      DB_PASSWORD: 'secret',
    };
    expect(() =>
      configureDatabaseUrl({ ...environment, [name]: undefined }),
    ).toThrow(`${name} is required`);
  });
});
