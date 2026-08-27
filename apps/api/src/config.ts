interface BaseAppConfig {
  allowedOrigin: string;
  passwordPepper: string;
  port: number;
  verificationDigestKey: string;
}

export type AppConfig = BaseAppConfig &
  (
    | { emailDeliveryMode: 'console' }
    | { emailDeliveryMode: 'ses'; awsRegion: string; sesFromEmail: string }
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
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const base = {
    allowedOrigin: environment.ALLOWED_ORIGIN ?? 'http://localhost:5173',
    passwordPepper: required(environment, 'PASSWORD_PEPPER'),
    port: parsedPort,
    verificationDigestKey: required(environment, 'VERIFICATION_DIGEST_KEY'),
  };
  const emailDeliveryMode = environment.EMAIL_DELIVERY_MODE ?? 'ses';
  if (emailDeliveryMode !== 'console' && emailDeliveryMode !== 'ses') {
    throw new Error('EMAIL_DELIVERY_MODE must be console or ses');
  }
  if (emailDeliveryMode === 'console') {
    return { ...base, emailDeliveryMode: 'console' };
  }
  return {
    ...base,
    emailDeliveryMode: 'ses',
    awsRegion: required(environment, 'AWS_REGION'),
    sesFromEmail: required(environment, 'SES_FROM_EMAIL'),
  };
}
