/** @spec onboarding-welcome-email REQ-004, REQ-006, REQ-014 */

interface WelcomeEmailWorkerDependencies {
  runOnce(): Promise<unknown>;
  schedule(callback: () => void, intervalMs: number): unknown;
  cancel(timer: unknown): void;
  intervalMs: number;
  recordEvent(name: string): void;
}

export function createWelcomeEmailWorker(
  dependencies: WelcomeEmailWorkerDependencies,
) {
  let timer: unknown;
  let active = false;

  const poll = () => {
    if (active) return;
    active = true;
    void dependencies
      .runOnce()
      .catch(() => {
        dependencies.recordEvent('welcome_email_worker_unexpected_failure');
      })
      .finally(() => {
        active = false;
      });
  };

  return {
    start(): void {
      if (timer !== undefined) return;
      timer = dependencies.schedule(poll, dependencies.intervalMs);
    },
    stop(): void {
      if (timer === undefined) return;
      dependencies.cancel(timer);
      timer = undefined;
    },
  };
}
