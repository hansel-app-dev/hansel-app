interface BaseAppConfig {
  allowedOrigin: string;
  applicationSessionDigestKey: string;
  contactSalesDestination: string;
  dashboardEnabled: boolean;
  discoveryEnabled: boolean;
  runtimeEnvironment: 'test' | 'production';
  planSelectionEnabled: boolean;
  organizationProfileEnabled: boolean;
  passwordPepper: string;
  port: number;
  verificationDigestKey: string;
  welcomeEmailEnabled: boolean;
}

export type AppConfig = BaseAppConfig &
  (
    | { emailDeliveryMode: 'console' }
    | {
        emailDeliveryMode: 'resend';
        resendApiKey: string;
        resendFromEmail: string;
      }
  );

function applicationOrigin(
  value: string,
  runtimeEnvironment: BaseAppConfig['runtimeEnvironment'],
): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('ALLOWED_ORIGIN must be an absolute application origin');
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('ALLOWED_ORIGIN must contain only a trusted origin');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    url.protocol !== 'https:' &&
    !(runtimeEnvironment === 'test' && url.protocol === 'http:' && loopback)
  )
    throw new Error(
      'ALLOWED_ORIGIN must use HTTPS or local/test HTTP loopback',
    );
  return url.origin;
}

export function dashboardUrl(config: Pick<AppConfig, 'allowedOrigin'>): string {
  return new URL('/dashboard', config.allowedOrigin).toString();
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const parsedPort = Number(environment.PORT ?? '3000');
  const runtimeEnvironment: 'test' | 'production' =
    environment.NODE_ENV === 'production' ? 'production' : 'test';
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const verificationDigestKey = required(
    environment,
    'VERIFICATION_DIGEST_KEY',
  );
  const applicationSessionDigestKey =
    environment.APPLICATION_SESSION_DIGEST_KEY === undefined &&
    runtimeEnvironment === 'test'
      ? verificationDigestKey
      : required(environment, 'APPLICATION_SESSION_DIGEST_KEY');
  const allowedOrigin = applicationOrigin(
    environment.ALLOWED_ORIGIN ?? 'http://localhost:5173',
    runtimeEnvironment,
  );
  const welcomeEmailEnabled =
    environment.WELCOME_EMAIL_ENABLED === 'true' ||
    (environment.WELCOME_EMAIL_ENABLED === undefined &&
      runtimeEnvironment !== 'production');
  const base = {
    allowedOrigin,
    applicationSessionDigestKey,
    contactSalesDestination:
      environment.CONTACT_SALES_DESTINATION ??
      'https://www.hanselapp.io/contact',
    dashboardEnabled:
      environment.DASHBOARD_ENABLED === 'true' ||
      (environment.DASHBOARD_ENABLED === undefined &&
        environment.NODE_ENV !== 'production'),
    discoveryEnabled:
      environment.DISCOVERY_ENABLED === 'true' ||
      (environment.DISCOVERY_ENABLED === undefined &&
        environment.NODE_ENV !== 'production'),
    runtimeEnvironment,
    planSelectionEnabled:
      environment.PLAN_SELECTION_ENABLED === 'true' ||
      (environment.PLAN_SELECTION_ENABLED === undefined &&
        environment.NODE_ENV !== 'production'),
    organizationProfileEnabled:
      environment.ORGANIZATION_PROFILE_ENABLED === 'true' ||
      (environment.ORGANIZATION_PROFILE_ENABLED === undefined &&
        environment.NODE_ENV !== 'production'),
    passwordPepper: required(environment, 'PASSWORD_PEPPER'),
    port: parsedPort,
    verificationDigestKey,
    welcomeEmailEnabled,
  };
  if (!base.contactSalesDestination.startsWith('https://'))
    throw new Error('CONTACT_SALES_DESTINATION must use HTTPS');
  const emailDeliveryMode = environment.EMAIL_DELIVERY_MODE ?? 'resend';
  if (emailDeliveryMode !== 'console' && emailDeliveryMode !== 'resend') {
    throw new Error('EMAIL_DELIVERY_MODE must be console or resend');
  }
  if (emailDeliveryMode === 'console') {
    if (runtimeEnvironment === 'production')
      throw new Error('Production email delivery requires Resend');
    return { ...base, emailDeliveryMode: 'console' };
  }
  const resendApiKey = required(environment, 'RESEND_API_KEY');
  const resendFromEmail = required(environment, 'RESEND_FROM_EMAIL');
  if (runtimeEnvironment === 'production' && !resendApiKey.startsWith('re_'))
    throw new Error('RESEND_API_KEY is invalid');
  if (
    runtimeEnvironment === 'production' &&
    !/^(?:[^<>]+\s<)?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(resendFromEmail)
  )
    throw new Error('RESEND_FROM_EMAIL is invalid');
  return {
    ...base,
    emailDeliveryMode: 'resend',
    resendApiKey,
    resendFromEmail,
  };
}
