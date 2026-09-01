/** @spec sites-add-new REQ-015 */
export function createSiteInvitationWorker(dependencies: {
  runOnce(): Promise<unknown>;
  schedule(callback: () => void, intervalMs: number): unknown;
  cancel(timer: unknown): void;
  recordEvent(name: string): void;
}) {
  let timer: unknown;
  let active = false;
  const poll = () => {
    if (active) return;
    active = true;
    void dependencies
      .runOnce()
      .catch(() => {
        dependencies.recordEvent('site_invitation_worker_failure');
      })
      .finally(() => {
        active = false;
      });
  };
  return {
    start() {
      if (timer !== undefined) return;
      timer = dependencies.schedule(poll, 1_000);
    },
    stop() {
      if (timer === undefined) return;
      dependencies.cancel(timer);
      timer = undefined;
    },
  };
}
