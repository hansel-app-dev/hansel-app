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
  const base = {
    allowedOrigin: environment.ALLOWED_ORIGIN ?? 'http://localhost:5173',
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
  };
  if (!base.contactSalesDestination.startsWith('https://'))
    throw new Error('CONTACT_SALES_DESTINATION must use HTTPS');
  const emailDeliveryMode = environment.EMAIL_DELIVERY_MODE ?? 'resend';
  if (emailDeliveryMode !== 'console' && emailDeliveryMode !== 'resend') {
    throw new Error('EMAIL_DELIVERY_MODE must be console or resend');
  }
  if (emailDeliveryMode === 'console') {
    return { ...base, emailDeliveryMode: 'console' };
  }
  return {
    ...base,
    emailDeliveryMode: 'resend',
    resendApiKey: required(environment, 'RESEND_API_KEY'),
    resendFromEmail: required(environment, 'RESEND_FROM_EMAIL'),
  };
}
