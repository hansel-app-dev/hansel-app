interface BaseAppConfig {
  allowedOrigin: string;
  applicationSessionDigestKey: string;
  contactSalesDestination: string;
  dashboardEnabled: boolean;
  sitesEnabled: boolean;
  allocationPlansEnabled: boolean;
  allocationPlansBucketName: string | null;
  discoveryEnabled: boolean;
  runtimeEnvironment: 'test' | 'production';
  planSelectionEnabled: boolean;
  organizationProfileEnabled: boolean;
  passwordPepper: string;
  passwordRecoveryEnabled: boolean;
  port: number;
  verificationDigestKey: string;
  welcomeEmailEnabled: boolean;
  loginEnabled: boolean;
  externalAuthEnabled: boolean;
  externalAuth: ExternalAuthConfig | null;
}

export interface ExternalAuthConfig {
  transactionKey: string;
  google: { clientId: string; clientSecret: string; callbackUri: string };
  microsoft: {
    clientId: string;
    clientSecret: string;
    tenantId: string;
    callbackUri: string;
  };
  apple: {
    clientId: string;
    teamId: string;
    keyId: string;
    privateKey: string;
    callbackUri: string;
  };
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

export function passwordResetUrl(
  config: Pick<AppConfig, 'allowedOrigin'>,
): string {
  return new URL('/reset-password', config.allowedOrigin).toString();
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
  const externalAuthEnabled = environment.EXTERNAL_AUTH_ENABLED === 'true';
  let externalAuth: ExternalAuthConfig | null = null;
  if (externalAuthEnabled) {
    if (
      runtimeEnvironment === 'production' &&
      allowedOrigin !== 'https://app.hanselapp.io'
    )
      throw new Error(
        'Production external authentication requires https://app.hanselapp.io',
      );
    const transactionKey = required(
      environment,
      'EXTERNAL_AUTH_TRANSACTION_KEY',
    );
    if (transactionKey.length < 32)
      throw new Error(
        'EXTERNAL_AUTH_TRANSACTION_KEY must be at least 32 characters',
      );
    const appleCallbackUri = required(environment, 'APPLE_CALLBACK_URL');
    let appleCallback: URL;
    try {
      appleCallback = new URL(appleCallbackUri);
    } catch {
      throw new Error('APPLE_CALLBACK_URL must be an absolute HTTPS callback');
    }
    if (
      appleCallback.protocol !== 'https:' ||
      appleCallback.username ||
      appleCallback.password ||
      appleCallback.search ||
      appleCallback.hash ||
      appleCallback.pathname !== '/auth/callback/apple'
    )
      throw new Error('APPLE_CALLBACK_URL must be an absolute HTTPS callback');
    const productionAppleCallback = new URL(
      '/auth/callback/apple',
      allowedOrigin,
    ).toString();
    if (
      runtimeEnvironment === 'production' &&
      appleCallback.toString() !== productionAppleCallback
    )
      throw new Error('APPLE_CALLBACK_URL must match the production callback');
    externalAuth = {
      transactionKey,
      google: {
        clientId: required(environment, 'GOOGLE_CLIENT_ID'),
        clientSecret: required(environment, 'GOOGLE_CLIENT_SECRET'),
        callbackUri: new URL('/auth/callback/google', allowedOrigin).toString(),
      },
      microsoft: {
        clientId: required(environment, 'MICROSOFT_CLIENT_ID'),
        clientSecret: required(environment, 'MICROSOFT_CLIENT_SECRET'),
        tenantId: required(environment, 'MICROSOFT_TENANT_ID'),
        callbackUri: new URL(
          '/auth/callback/microsoft',
          allowedOrigin,
        ).toString(),
      },
      apple: {
        clientId: required(environment, 'APPLE_CLIENT_ID'),
        teamId: required(environment, 'APPLE_TEAM_ID'),
        keyId: required(environment, 'APPLE_KEY_ID'),
        privateKey: required(environment, 'APPLE_PRIVATE_KEY').replace(
          /\\n/g,
          '\n',
        ),
        callbackUri: appleCallback.toString(),
      },
    };
  }
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
    sitesEnabled:
      environment.SITES_ENABLED === 'true' ||
      (environment.SITES_ENABLED === undefined &&
        environment.NODE_ENV !== 'production'),
    allocationPlansEnabled: environment.ALLOCATION_PLANS_ENABLED === 'true',
    allocationPlansBucketName:
      environment.ALLOCATION_PLANS_BUCKET_NAME?.trim() ?? null,
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
    passwordRecoveryEnabled:
      environment.PASSWORD_RECOVERY_ENABLED === 'true' ||
      (environment.PASSWORD_RECOVERY_ENABLED === undefined &&
        environment.NODE_ENV !== 'production'),
    port: parsedPort,
    verificationDigestKey,
    welcomeEmailEnabled,
    loginEnabled:
      environment.LOGIN_ENABLED === 'true' ||
      (environment.LOGIN_ENABLED === undefined &&
        environment.NODE_ENV !== 'production'),
    externalAuthEnabled,
    externalAuth,
  };
  if (!base.contactSalesDestination.startsWith('https://'))
    throw new Error('CONTACT_SALES_DESTINATION must use HTTPS');
  if (base.allocationPlansEnabled && !base.allocationPlansBucketName)
    throw new Error(
      'ALLOCATION_PLANS_BUCKET_NAME is required when Allocation Plans are enabled',
    );
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
