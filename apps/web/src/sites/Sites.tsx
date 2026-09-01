/** @spec sites-empty-state REQ-001..REQ-013 @figma 2024:9828 */
import type { DashboardResponse } from '@hansel/contracts';
import { Button } from '../design-system/index.js';
import {
  ApplicationShell,
  AppSymbol,
  NotificationSymbol,
} from '../application-shell/ApplicationShell.js';

function NewSiteButton({ compact = false }: { compact?: boolean }) {
  return (
    <Button
      aria-disabled="true"
      disabled
      className={`disabled:opacity-100 ${compact ? 'min-h-9 px-4 py-2' : 'mt-6'}`}
    >
      <AppSymbol className="mr-2 !size-4 text-[18px]">add</AppSymbol>
      New site
    </Button>
  );
}

export function Sites({
  loadDashboard,
  logout,
  navigate,
}: {
  loadDashboard: () => Promise<DashboardResponse>;
  logout: () => Promise<void>;
  navigate?: (destination: string) => void;
}) {
  return (
    <ApplicationShell
      activePage="Sites"
      loadDashboard={loadDashboard}
      loadErrorMessage="We couldn't load your account. Please try again."
      logout={logout}
      navigate={navigate}
      headerActions={
        <>
          <NotificationSymbol />
          <NewSiteButton compact />
        </>
      }
    >
      <section
        aria-labelledby="sites-empty-heading"
        className="relative grid min-h-[calc(100vh-68px)] place-items-center px-8 py-24 max-md:min-h-[560px] max-md:px-5"
      >
        <div
          className="absolute right-8 top-6 flex items-center gap-3 max-md:right-5 max-md:top-5"
          aria-label="Site view"
        >
          <button
            type="button"
            disabled
            aria-disabled="true"
            aria-label="Grid view"
            className="text-[#3f4654] disabled:cursor-not-allowed"
          >
            <AppSymbol weight={100}>grid_view</AppSymbol>
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            aria-label="List view"
            className="text-[#a5a5a5] disabled:cursor-not-allowed"
          >
            <AppSymbol weight={100}>view_list</AppSymbol>
          </button>
        </div>
        <div className="flex max-w-sm flex-col items-center text-center">
          <AppSymbol
            weight={100}
            className="!size-14 text-[56px] text-[#a7a7a7]"
          >
            map
          </AppSymbol>
          <h2
            id="sites-empty-heading"
            className="mt-5 text-[18px] font-semibold leading-7"
          >
            No sites
          </h2>
          <p className="mt-1 text-[15px] leading-6 text-[#737373]">
            Create a new site to get started.
          </p>
          <NewSiteButton />
        </div>
      </section>
    </ApplicationShell>
  );
}
