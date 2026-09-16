/** @spec microsoft-local-auth REQ-004..REQ-008 */
import express from 'express';
import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { registerMicrosoftSignupRoutes } from './microsoft-signup-routes.js';

it('handles expired state, invalid forms, verification rejection, and outages in both renderers [microsoft-local-auth REQ-008]', async () => {
  const signup = {
    start: vi.fn(),
    read: vi.fn().mockResolvedValue(null),
    send: vi.fn(),
    verify: vi.fn(),
    cleanup: vi.fn(),
  };
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  registerMicrosoftSignupRoutes(app, {
    signup,
    allowedOrigin: 'http://localhost:5173',
    complete: vi.fn(),
  });
  await request(app).get('/api/auth/microsoft/signup').expect(401);
  expect(
    (await request(app).get('/onboarding/microsoft-email')).text,
  ).toContain('Your signup has expired');
  await request(app)
    .post('/auth/microsoft/signup')
    .set('Origin', 'http://localhost:5173')
    .type('form')
    .send({ action: 'verify', code: '123456' })
    .expect(401);
  signup.read.mockResolvedValue({ email: '', sent: false, resendAfter: 0 });
  await request(app)
    .get('/api/auth/microsoft/signup')
    .set('Cookie', 'other=value')
    .expect(200);
  expect(
    (await request(app).get('/onboarding/microsoft-email')).text,
  ).toContain('Send verification code');
  await request(app)
    .post('/auth/microsoft/signup')
    .set('Origin', 'http://localhost:5173')
    .set('Cookie', 'hansel_microsoft_pending=credential')
    .type('form')
    .send({ unexpected: 'value' })
    .expect(400);
  for (const path of [
    '/api/auth/microsoft/signup/verify',
    '/auth/microsoft/signup',
  ]) {
    signup.verify.mockResolvedValue(null);
    await request(app)
      .post(path)
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', 'hansel_microsoft_pending=credential')
      .send(
        path.startsWith('/api')
          ? { code: '123456' }
          : { action: 'verify', code: '123456' },
      )
      .expect(400);
    signup.verify.mockRejectedValue(new Error('Private database details'));
    const failure = await request(app)
      .post(path)
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', 'hansel_microsoft_pending=credential')
      .send(
        path.startsWith('/api')
          ? { code: '123456' }
          : { action: 'verify', code: '123456' },
      )
      .expect(503);
    expect(failure.text).not.toContain('Private database details');
  }
  signup.verify.mockResolvedValue({
    destination: '/onboarding/about-you',
    onboardingCredential: 'private',
  });
  await request(app)
    .post('/auth/microsoft/signup')
    .set('Origin', 'http://localhost:5173')
    .set('Cookie', 'hansel_microsoft_pending=credential')
    .send({ action: 'verify', code: '123456' })
    .expect(303)
    .expect('Location', '/onboarding/about-you');
  signup.read.mockRejectedValue(new Error('Private database details'));
  await request(app).get('/api/auth/microsoft/signup').expect(503);
});

it('serves private native forms and closes successful verification redirects [microsoft-local-auth REQ-005, REQ-007]', async () => {
  const signup = {
    start: vi.fn(),
    read: vi.fn().mockResolvedValue({
      email: 'person@example.com',
      sent: true,
      resendAfter: 0,
    }),
    send: vi.fn().mockResolvedValue('sent'),
    verify: vi.fn().mockResolvedValue({
      destination: '/onboarding/about-you',
      onboardingCredential: 'private-continuation',
    }),
    cleanup: vi.fn(),
  };
  const complete = vi.fn();
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  registerMicrosoftSignupRoutes(app, {
    signup,
    allowedOrigin: 'http://localhost:5173',
    complete,
  });
  const form = await request(app)
    .get('/onboarding/microsoft-email')
    .set('Cookie', 'hansel_microsoft_pending=credential')
    .expect(200);
  expect(form.headers['cache-control']).toBe('private, no-store');
  expect(form.text).toContain('action="/auth/microsoft/signup"');
  expect(form.text).toContain('p***@example.com');
  await request(app)
    .post('/auth/microsoft/signup')
    .set('Origin', 'http://localhost:5173')
    .set('Cookie', 'hansel_microsoft_pending=credential')
    .type('form')
    .send({ action: 'send', email: 'person@example.com' })
    .expect(303)
    .expect('Location', '/onboarding/microsoft-email');
  const result = await request(app)
    .post('/api/auth/microsoft/signup/verify')
    .set('Origin', 'http://localhost:5173')
    .set('Cookie', 'hansel_microsoft_pending=credential')
    .send({ code: '123456' })
    .expect(200);
  expect(result.body).toEqual({ destination: '/onboarding/about-you' });
  expect(result.text).not.toContain('private-continuation');
  expect(complete).toHaveBeenCalledWith(
    expect.anything(),
    'private-continuation',
  );
});

it.each([
  ['limited', 429],
  ['unavailable', 503],
  ['expired', 401],
  ['invalid', 400],
] as const)(
  'returns safe send failure %s [microsoft-local-auth REQ-006, REQ-008]',
  async (outcome, status) => {
    const signup = {
      start: vi.fn(),
      read: vi
        .fn()
        .mockResolvedValue({ email: '', sent: false, resendAfter: 0 }),
      send: vi.fn().mockResolvedValue(outcome),
      verify: vi.fn(),
      cleanup: vi.fn(),
    };
    const app = express();
    app.use(express.json());
    registerMicrosoftSignupRoutes(app, {
      signup,
      allowedOrigin: 'http://localhost:5173',
      complete: vi.fn(),
    });
    await request(app)
      .post('/api/auth/microsoft/signup/send')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', 'hansel_microsoft_pending=credential')
      .send({ email: 'person@example.com' })
      .expect(status);
  },
);

it('requires the pending browser cookie and exact origin for email submission [microsoft-local-auth REQ-004, REQ-005]', async () => {
  const signup = {
    start: vi.fn(),
    read: vi.fn().mockResolvedValue({ email: '', sent: false, resendAfter: 0 }),
    send: vi.fn().mockResolvedValue('sent'),
    verify: vi.fn(),
    cleanup: vi.fn(),
  };
  const app = express();
  app.use(express.json());
  registerMicrosoftSignupRoutes(app, {
    signup,
    allowedOrigin: 'http://localhost:5173',
    complete: vi.fn(),
  });
  await request(app)
    .post('/api/auth/microsoft/signup/send')
    .send({ email: 'test@example.com' })
    .expect(403);
  await request(app)
    .post('/api/auth/microsoft/signup/send')
    .set('Origin', 'http://localhost:5173')
    .send({ email: 'test@example.com' })
    .expect(401);
  await request(app)
    .post('/api/auth/microsoft/signup/send')
    .set('Origin', 'http://localhost:5173')
    .set('Cookie', 'hansel_microsoft_pending=credential')
    .send({ email: 'test@example.com', extra: 'reject' })
    .expect(400);
  expect(signup.send).not.toHaveBeenCalled();
  await request(app)
    .post('/api/auth/microsoft/signup/send')
    .set('Origin', 'http://localhost:5173')
    .set('Cookie', 'hansel_microsoft_pending=credential')
    .send({ email: 'test@example.com' })
    .expect(200);
});
