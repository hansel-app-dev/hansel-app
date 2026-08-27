import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

const app = createApp({ allowedOrigin: 'https://app.example.com' });

describe('API [REQ-002]', () => {
  it('returns the specified health response', async () => {
    const response = await request(app).get('/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('returns a stable not-found response', async () => {
    await request(app).get('/missing').expect(404, { error: 'not_found' });
  });

  it('handles unexpected errors without leaking details', async () => {
    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const failingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      (router) => {
        router.get('/failure', () => {
          throw new Error('secret');
        });
      },
    );
    await request(failingApp)
      .get('/failure')
      .expect(500, { error: 'internal_error' });
    expect(errorLog).toHaveBeenCalledOnce();
    errorLog.mockRestore();
  });
});
