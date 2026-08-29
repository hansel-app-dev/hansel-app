import { describe, expect, it } from 'vitest';
import { dashboardUrl, loadConfig } from './config.js';

describe('loadConfig [REQ-002, REQ-008; onboarding-welcome-email REQ-009, REQ-013, REQ-016]', () => {
  const required = {
    PASSWORD_PEPPER: 'password-pepper',
    VERIFICATION_DIGEST_KEY: 'verification-digest-key',
    APPLICATION_SESSION_DIGEST_KEY: 'application-session-digest-key',
    RESEND_API_KEY: 're_test',
    RESEND_FROM_EMAIL: 'Hansel <onboarding@hanselapp.io>',
  };

  it('uses safe network defaults with explicit security configuration', () => {
    expect(loadConfig(required)).toEqual({
      allowedOrigin: 'http://localhost:5173',
      contactSalesDestination: 'https://www.hanselapp.io/contact',
      dashboardEnabled: true,
      discoveryEnabled: true,
      runtimeEnvironment: 'test',
      planSelectionEnabled: true,
      organizationProfileEnabled: true,
      welcomeEmailEnabled: true,
      port: 3000,
      passwordPepper: 'password-pepper',
      verificationDigestKey: 'verification-digest-key',
      applicationSessionDigestKey: 'application-session-digest-key',
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
      contactSalesDestination: 'https://www.hanselapp.io/contact',
      dashboardEnabled: true,
      discoveryEnabled: true,
      runtimeEnvironment: 'test',
      planSelectionEnabled: true,
      organizationProfileEnabled: true,
      welcomeEmailEnabled: true,
      port: 8080,
      passwordPepper: 'password-pepper',
      verificationDigestKey: 'verification-digest-key',
      applicationSessionDigestKey: 'application-session-digest-key',
      resendApiKey: 're_test',
      resendFromEmail: 'Hansel <onboarding@hanselapp.io>',
      emailDeliveryMode: 'resend',
    });
  });

  it('identifies the production runtime [onboarding-plan-selection REQ-018]', () => {
    const production = {
      ...required,
      NODE_ENV: 'production',
      ALLOWED_ORIGIN: 'https://app.hanselapp.io',
    };
    expect(loadConfig(production)).toMatchObject({
      runtimeEnvironment: 'production',
      dashboardEnabled: false,
      discoveryEnabled: false,
      planSelectionEnabled: false,
      organizationProfileEnabled: false,
      welcomeEmailEnabled: false,
    });
    expect(
      loadConfig({
        ...production,
        PLAN_SELECTION_ENABLED: 'true',
      }).planSelectionEnabled,
    ).toBe(true);
    expect(
      loadConfig({
        ...production,
        WELCOME_EMAIL_ENABLED: 'true',
      }).welcomeEmailEnabled,
    ).toBe(true);
    expect(() =>
      loadConfig({
        ...production,
        ALLOWED_ORIGIN: 'http://localhost:5173',
        WELCOME_EMAIL_ENABLED: 'true',
      }),
    ).toThrow('ALLOWED_ORIGIN must use HTTPS');
    expect(
      loadConfig({
        ...production,
        ORGANIZATION_PROFILE_ENABLED: 'true',
      }).organizationProfileEnabled,
    ).toBe(true);
    expect(
      loadConfig({
        ...production,
        DISCOVERY_ENABLED: 'true',
      }).discoveryEnabled,
    ).toBe(true);
    expect(
      loadConfig({
        ...production,
        DASHBOARD_ENABLED: 'true',
      }).dashboardEnabled,
    ).toBe(true);
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
      contactSalesDestination: 'https://www.hanselapp.io/contact',
      dashboardEnabled: true,
      discoveryEnabled: true,
      runtimeEnvironment: 'test',
      planSelectionEnabled: true,
      organizationProfileEnabled: true,
      welcomeEmailEnabled: true,
      port: 3000,
      passwordPepper: 'password-pepper',
      verificationDigestKey: 'verification-digest-key',
      applicationSessionDigestKey: 'verification-digest-key',
      emailDeliveryMode: 'console',
    });
  });

  it('builds only a trusted absolute dashboard URL', () => {
    expect(dashboardUrl(loadConfig(required))).toBe(
      'http://localhost:5173/dashboard',
    );
    expect(
      dashboardUrl(
        loadConfig({ ...required, ALLOWED_ORIGIN: 'https://app.hansel.io/' }),
      ),
    ).toBe('https://app.hansel.io/dashboard');
    for (const origin of [
      'http://example.com',
      'ftp://localhost',
      'https://user:password@app.hansel.io',
      'https://app.hansel.io/path',
      'https://app.hansel.io?tenant=private',
      'not-a-url',
    ])
      expect(() => loadConfig({ ...required, ALLOWED_ORIGIN: origin })).toThrow(
        'ALLOWED_ORIGIN',
      );
  });

  it('fails closed for console or invalid Resend configuration in production', () => {
    expect(() =>
      loadConfig({
        ...required,
        NODE_ENV: 'production',
        EMAIL_DELIVERY_MODE: 'console',
        ALLOWED_ORIGIN: 'https://app.hansel.io',
      }),
    ).toThrow('Production email delivery requires Resend');
    expect(() =>
      loadConfig({
        ...required,
        NODE_ENV: 'production',
        RESEND_API_KEY: 'invalid',
        ALLOWED_ORIGIN: 'https://app.hansel.io',
      }),
    ).toThrow('RESEND_API_KEY is invalid');
    expect(() =>
      loadConfig({
        ...required,
        NODE_ENV: 'production',
        RESEND_FROM_EMAIL: 'invalid',
        ALLOWED_ORIGIN: 'https://app.hansel.io',
      }),
    ).toThrow('RESEND_FROM_EMAIL is invalid');
  });

  it('rejects an unsupported email delivery mode', () => {
    expect(() =>
      loadConfig({ ...required, EMAIL_DELIVERY_MODE: 'unknown' }),
    ).toThrow('EMAIL_DELIVERY_MODE must be console or resend');
  });

  it('rejects an insecure contact-sales destination [onboarding-plan-selection REQ-008]', () => {
    expect(() =>
      loadConfig({
        ...required,
        CONTACT_SALES_DESTINATION: 'http://example.com',
      }),
    ).toThrow('CONTACT_SALES_DESTINATION must use HTTPS');
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
    'APPLICATION_SESSION_DIGEST_KEY',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
  ])('rejects missing %s', (name) => {
    expect(() => loadConfig({ ...required, [name]: '' })).toThrow(
      `${name} is required`,
    );
  });
});
