import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

describe('Google routes [google-local-auth REQ-001, REQ-003, REQ-005]', () => {
  const setup = () => {
    const auth = {
      login: vi.fn(),
      enabledProviders: ['google'] as const,
      startExternal: vi
        .fn()
        .mockResolvedValue(
          'https://accounts.google.com/authorize?state=browser-state',
        ),
      callbackExternal: vi.fn().mockResolvedValue({ status: 'rejected' }),
    };
    return {
      auth,
      app: createApp(
        { allowedOrigin: 'http://localhost:5173', externalAuthEnabled: true },
        undefined,
        undefined,
        undefined,
        auth,
      ),
    };
  };
  it('advertises only enabled providers and rejects disabled routes', async () => {
    const { app } = setup();
    await request(app)
      .get('/api/auth/providers')
      .expect(200, { providers: ['google'] });
    await request(app).get('/auth/start/apple?intent=login').expect(404);
  });
  it('preserves the issuer response parameter for OpenID validation', async () => {
    const { app, auth } = setup();
    await request(app)
      .get('/auth/callback/google')
      .query({
        code: 'x',
        state: 'browser-state',
        iss: 'https://accounts.google.com',
        ignored: 'extra',
      })
      .set('Cookie', 'hansel_external_google=browser-state')
      .expect(303);
    expect(auth.callbackExternal).toHaveBeenCalledWith('google', {
      code: 'x',
      state: 'browser-state',
      iss: 'https://accounts.google.com',
    });
  });
  it('shows a safe provider failure message on the native login page', async () => {
    const { app } = setup();
    const result = await request(app)
      .get('/login?error=provider_unavailable')
      .expect(200);
    expect(result.text).toContain('role="alert"');
    expect(result.text).toContain('temporarily unavailable');
  });
  it('explains rejected provider sign-in on the native page [microsoft-local-auth REQ-009]', async () => {
    const { app } = setup();
    const result = await request(app).get('/login?error=authentication_failed').expect(200);
    expect(result.text).toContain('Use the sign-in method you used to create your account.');
  });
  it('requires same-origin consent before onboarding and sets an HttpOnly binding', async () => {
    const { app, auth } = setup();
    await request(app)
      .post('/auth/start/google')
      .type('form')
      .send({ intent: 'onboarding', acceptsTerms: 'true' })
      .expect(403);
    const result = await request(app)
      .post('/auth/start/google')
      .set('Origin', 'http://localhost:5173')
      .type('form')
      .send({ intent: 'onboarding', acceptsTerms: 'true' })
      .expect(303);
    expect(auth.startExternal).toHaveBeenCalledWith('google', 'onboarding');
    expect(result.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('HttpOnly')]),
    );
  });
  it('rejects a callback from a different browser before provider exchange', async () => {
    const { app, auth } = setup();
    await request(app)
      .get('/auth/callback/google?code=x&state=browser-state')
      .expect(303);
    expect(auth.callbackExternal).not.toHaveBeenCalled();
    await request(app)
      .get('/auth/callback/google?code=x&state=browser-state')
      .set('Cookie', 'hansel_external_google=browser-state')
      .expect(303);
    expect(auth.callbackExternal).toHaveBeenCalledOnce();
  });

  it('returns users without verified email to email signup without session cookies [google-local-auth REQ-004]', async () => {
    const { app, auth } = setup();
    auth.callbackExternal.mockResolvedValueOnce({
      status: 'email-signup-required',
    });
    const result = await request(app)
      .get('/auth/callback/google?code=x&state=browser-state')
      .set('Cookie', 'hansel_external_google=browser-state')
      .expect(303);
    expect(result.headers.location).toBe(
      '/onboarding?error=google_email_required',
    );
    expect(JSON.stringify(result.headers['set-cookie'])).not.toContain(
      'hansel_access',
    );
  });
});
