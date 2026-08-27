interface LocalVerificationLogger {
  info(message: string): void;
}

export function createConsoleVerificationSender(
  logger: LocalVerificationLogger = console,
) {
  return function sendVerificationCode(email: string, code: string) {
    logger.info(
      JSON.stringify({
        level: 'INFO',
        message: 'Local verification email',
        email,
        code,
      }),
    );
    return Promise.resolve();
  };
}
