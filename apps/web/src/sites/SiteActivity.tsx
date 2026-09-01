/** @spec sites-add-new REQ-019 */
import { useEffect, useState } from 'react';
import type {
  DashboardResponse,
  SiteActivityResponse,
} from '@hansel/contracts';
import {
  ApplicationShell,
  NotificationSymbol,
} from '../application-shell/ApplicationShell.js';

export function SiteActivity({
  loadActivity,
  loadDashboard,
  logout,
  navigate,
}: {
  loadActivity: () => Promise<SiteActivityResponse>;
  loadDashboard: () => Promise<DashboardResponse>;
  logout: () => Promise<void>;
  navigate?: (destination: string) => void;
}) {
  const [result, setResult] = useState<SiteActivityResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void loadActivity()
      .then(setResult)
      .catch(() => {
        setFailed(true);
      });
  }, [loadActivity]);
  return (
    <ApplicationShell
      activePage="Sites"
      headerActions={<NotificationSymbol />}
      loadDashboard={loadDashboard}
      loadErrorMessage="We couldn't load your account. Please try again."
      logout={logout}
      navigate={navigate}
    >
      <section className="px-8 py-8 max-md:px-5">
        {failed ? (
          <p className="text-sm text-danger" role="alert">
            We couldn't load this site.
          </p>
        ) : result ? (
          <>
            <p className="text-sm text-content-muted">Site</p>
            <h2 className="mt-1 text-2xl font-semibold">{result.site.name}</h2>
            <nav
              aria-label="Site sections"
              className="mt-8 border-b border-control-border"
            >
              <a
                className="inline-block border-b-2 border-action-primary px-1 pb-3 text-sm font-medium"
                href={`/sites/${result.site.id}/activity`}
              >
                Activity
              </a>
            </nav>
            <div className="grid min-h-72 place-items-center text-center text-sm text-content-muted">
              Site activity will appear here.
            </div>
          </>
        ) : (
          <p className="text-sm text-content-muted" role="status">
            Loading site…
          </p>
        )}
      </section>
    </ApplicationShell>
  );
}
