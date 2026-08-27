import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig [REQ-002, REQ-008]', () => {
  const required = {
    PASSWORD_PEPPER: 'password-pepper',
    VERIFICATION_DIGEST_KEY: 'verification-digest-key',
    RESEND_API_KEY: 're_test',
    RESEND_FROM_EMAIL: 'Hansel <onboarding@hanselapp.io>',
  };

  it('uses safe network defaults with explicit security configuration', () => {
    expect(loadConfig(required)).toEqual({
      allowedOrigin: 'http://localhost:5173',
      port: 3000,
      passwordPepper: 'password-pepper',
      verificationDigestKey: 'verification-digest-key',
      resendApiKey: 're_test',
      resendFromEmail: 'Hansel <onboarding@hanselapp.io>',
      emailDeliveryMode: 'resend',
    });
  });

  it('reads valid environment values', () => {
    expect(
      loadConfig({
        ...required,
        PORT: '8080',
        ALLOWED_ORIGIN: 'https://hansel.example',
      }),
    ).toEqual({
      allowedOrigin: 'https://hansel.example',
      port: 8080,
      passwordPepper: 'password-pepper',
      verificationDigestKey: 'verification-digest-key',
      resendApiKey: 're_test',
      resendFromEmail: 'Hansel <onboarding@hanselapp.io>',
      emailDeliveryMode: 'resend',
    });
  });

  it('supports local console email without AWS email configuration', () => {
    expect(
      loadConfig({
        PASSWORD_PEPPER: 'password-pepper',
        VERIFICATION_DIGEST_KEY: 'verification-digest-key',
        EMAIL_DELIVERY_MODE: 'console',
      }),
    ).toEqual({
      allowedOrigin: 'http://localhost:5173',
      port: 3000,
      passwordPepper: 'password-pepper',
      verificationDigestKey: 'verification-digest-key',
      emailDeliveryMode: 'console',
    });
  });

  it('rejects an unsupported email delivery mode', () => {
    expect(() =>
      loadConfig({ ...required, EMAIL_DELIVERY_MODE: 'unknown' }),
    ).toThrow('EMAIL_DELIVERY_MODE must be console or resend');
  });

  it.each(['0', '65536', '1.5', 'invalid'])(
    'rejects invalid port %s',
    (port) => {
      expect(() => loadConfig({ ...required, PORT: port })).toThrow(
        'PORT must be an integer',
      );
    },
  );

  it.each([
    'PASSWORD_PEPPER',
    'VERIFICATION_DIGEST_KEY',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
  ])('rejects missing %s', (name) => {
    expect(() => loadConfig({ ...required, [name]: '' })).toThrow(
      `${name} is required`,
    );
  });
});
