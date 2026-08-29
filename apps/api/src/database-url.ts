/** @spec onboarding-welcome-email REQ-016 */

export function configureDatabaseUrl(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  if (environment.DATABASE_URL) return environment.DATABASE_URL;
  const required = (name: string): string => {
    const value = environment[name];
    if (!value)
      throw new Error(`${name} is required when DATABASE_URL is absent`);
    return value;
  };
  const host = required('DB_HOST');
  const port = required('DB_PORT');
  const database = required('DB_NAME');
  const username = required('DB_USERNAME');
  const password = required('DB_PASSWORD');
  const databaseUrl = `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}?schema=public`;
  environment.DATABASE_URL = databaseUrl;
  return databaseUrl;
}
