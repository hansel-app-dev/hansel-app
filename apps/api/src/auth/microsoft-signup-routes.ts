/** @spec microsoft-local-auth REQ-004..REQ-009 */
import type { Express, Response } from 'express';
import { z } from 'zod';
import type { createMicrosoftSignup } from './microsoft-signup.js';

export const microsoftPendingCookie = 'hansel_microsoft_pending';
const explanation =
  'Confirm your email to finish signing up with Microsoft. You only need to do this once.';
const escape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
const emailSchema = z
  .object({ email: z.string().trim().max(254).pipe(z.email()) })
  .strict();
const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();

function page(state: { email: string; sent: boolean } | null, error = '') {
  const email = state?.email ?? '';
  const masked = email.replace(/^(.)(.*)@/, '$1***@');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm email · Hansel</title><link rel="stylesheet" href="/assets/login-progressive.css"></head><body><main>
  <a class="logo" href="/" aria-label="Hansel home"><img src="/assets/hansel-logo-beta.svg" alt="Hansel"></a>
  <section class="login-panel"><h1>Confirm your email</h1><p>${explanation}</p>
  ${error ? `<p role="alert">${escape(error)}</p>` : ''}
  ${
    state
      ? `<form method="post" action="/auth/microsoft/signup"><input type="hidden" name="action" value="send"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" maxlength="254" required value="${escape(email)}"><button type="submit">${state.sent ? 'Send a new code' : 'Send verification code'}</button></form>
  ${state.sent ? `<p>Enter the code sent to ${escape(masked)}. It expires in 15 minutes.</p><form method="post" action="/auth/microsoft/signup"><input type="hidden" name="action" value="verify"><label for="code">Verification code</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required><button type="submit">Verify email</button></form>` : ''}`
      : '<p>Your signup has expired. Start again with Microsoft.</p>'
  }
  <a href="/onboarding">Create an account</a><a href="/login">Log in</a></section></main></body></html>`;
}

export function registerMicrosoftSignupRoutes(
  app: Express,
  deps: {
    signup: ReturnType<typeof createMicrosoftSignup>;
    allowedOrigin: string;
    complete(response: Response, credential: string): void;
  },
) {
  const credential = (header: string | undefined) =>
    header
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${microsoftPendingCookie}=`))
      ?.slice(microsoftPendingCookie.length + 1) ?? '';
  for (const path of [
    '/api/auth/microsoft/signup',
    '/onboarding/microsoft-email',
  ]) {
    app.get(path, async (request, response) => {
      response.set('Cache-Control', 'private, no-store').vary('Cookie');
      try {
        const state = await deps.signup.read(
          credential(request.headers.cookie),
        );
        if (path.startsWith('/api/'))
          response
            .status(state ? 200 : 401)
            .json(state ?? { error: 'expired' });
        else response.type('html').send(page(state));
      } catch {
        response
          .status(503)
          .send('Signup is temporarily unavailable. Please try again.');
      }
    });
  }
  for (const path of [
    '/api/auth/microsoft/signup/send',
    '/api/auth/microsoft/signup/verify',
    '/auth/microsoft/signup',
  ]) {
    app.post(path, async (request, response) => {
      response.set('Cache-Control', 'private, no-store');
      if (request.headers.origin !== deps.allowedOrigin) {
        response.status(403).json({ error: 'invalid_origin' });
        return;
      }
      const pending = credential(request.headers.cookie);
      const native = path === '/auth/microsoft/signup';
      try {
        const state = pending ? await deps.signup.read(pending) : null;
        if (!state) {
          response.status(401).send(native ? page(null) : { error: 'expired' });
          return;
        }
        const parsed = (
          native
            ? z.discriminatedUnion('action', [
                emailSchema.extend({ action: z.literal('send') }),
                codeSchema.extend({ action: z.literal('verify') }),
              ])
            : path.endsWith('/send')
              ? emailSchema
              : codeSchema
        ).safeParse(request.body);
        if (!parsed.success) {
          response
            .status(400)
            .send(
              native
                ? page(state, 'Enter a valid email or six-digit code.')
                : { error: 'invalid_request' },
            );
          return;
        }
        let error = '';
        let status = 400;
        if ('email' in parsed.data) {
          const sent = await deps.signup.send(pending, parsed.data.email);
          if (sent === 'sent') {
            if (native) response.redirect(303, '/onboarding/microsoft-email');
            else response.json({ status: 'sent' });
            return;
          }
          status =
            sent === 'limited'
              ? 429
              : sent === 'unavailable'
                ? 503
                : sent === 'expired'
                  ? 401
                  : 400;
          error =
            sent === 'limited'
              ? 'Please wait before requesting another code.'
              : sent === 'unavailable'
                ? 'We could not send your code. Please try again.'
                : 'Restart Microsoft signup and try again.';
        } else {
          const result = await deps.signup.verify(pending, parsed.data.code);
          if (result) {
            deps.complete(response, result.onboardingCredential);
            response.clearCookie(microsoftPendingCookie, {
              path: '/',
              httpOnly: true,
              sameSite: 'lax',
              secure: deps.allowedOrigin.startsWith('https:'),
            });
            if (native) response.redirect(303, result.destination);
            else response.json({ destination: result.destination });
            return;
          }
          error =
            "We couldn't finish signup. Retry or request a new code. If you already have an account, use your original sign-in method; linking Microsoft isn't supported yet.";
        }
        response.status(status).send(native ? page(state, error) : { error });
      } catch {
        response.status(503).send(
          native
            ? page(null, 'Signup is temporarily unavailable. Please try again.')
            : {
                error: 'Signup is temporarily unavailable. Please try again.',
              },
        );
      }
    });
  }
}
