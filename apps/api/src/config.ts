export interface AppConfig {
  allowedOrigin: string;
  port: number;
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const parsedPort = Number(environment.PORT ?? '3000');
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return {
    allowedOrigin: environment.ALLOWED_ORIGIN ?? 'http://localhost:5173',
    port: parsedPort,
  };
}
