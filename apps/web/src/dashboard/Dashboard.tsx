/** @spec dashboard-home REQ-001..REQ-017; dashboard-logout REQ-001..REQ-004, REQ-010; sites-empty-state REQ-003, REQ-004 */
import type { DashboardResponse } from '@hansel/contracts';
import {
  ApplicationShell,
  AppSymbol,
  NotificationSymbol,
} from '../application-shell/ApplicationShell.js';

export function Dashboard({
  loadDashboard,
  logout,
  navigate,
  preloadedDashboard,
}: {
  loadDashboard: () => Promise<DashboardResponse>;
  logout: () => Promise<void>;
  navigate?: (destination: string) => void;
  preloadedDashboard?: DashboardResponse;
}) {
  return (
    <ApplicationShell
      activePage="Dashboard"
      loadDashboard={loadDashboard}
      loadErrorMessage="We couldn't load your dashboard. Please try again."
      logout={logout}
      navigate={navigate}
      preloadedDashboard={preloadedDashboard}
      headerActions={
        <>
          <NotificationSymbol />
          <AppSymbol weight={100}>tune</AppSymbol>
        </>
      }
    >
      <section aria-labelledby="dashboard-content">
        <h2 id="dashboard-content" className="sr-only">
          Dashboard widgets
        </h2>
        <div className="grid grid-cols-4 gap-6 p-10 max-xl:grid-cols-2 max-md:grid-cols-1 max-md:p-5">
          {Array.from({ length: 4 }, (_, index) => (
            <article
              key={index}
              className="min-h-[244px] overflow-hidden rounded-lg border border-[#dddddd] bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
            >
              <h2 className="border-b border-[#e5e5e5] px-6 py-5 text-[16px] font-normal">
                Widget title
              </h2>
            </article>
          ))}
        </div>
      </section>
    </ApplicationShell>
  );
}
