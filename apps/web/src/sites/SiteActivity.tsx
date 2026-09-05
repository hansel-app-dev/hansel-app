/** @spec site-details-activity-shell REQ-001..REQ-021 @figma 2030:3333 */
import { useEffect, useState } from 'react';
import type {
  DashboardResponse,
  SiteActivityResponse,
  SitesPageResponse,
} from '@hansel/contracts';
import {
  ApplicationShell,
  AppSymbol,
} from '../application-shell/ApplicationShell.js';
import { Button } from '../design-system/index.js';
import { SiteMemberPreview } from './SiteCollection.js';

interface SiteActivityRequest {
  attempt: number;
  loadActivity: () => Promise<SiteActivityResponse>;
  loadDashboard: () => Promise<DashboardResponse>;
  loadSites: () => Promise<SitesPageResponse>;
}

type SiteActivityLoadState =
  | (SiteActivityRequest & {
      status: 'loaded';
      dashboard: DashboardResponse;
      activity: SiteActivityResponse;
      sitesPage: SitesPageResponse;
    })
  | (SiteActivityRequest & { status: 'failed' });

export function SiteActivity({
  loadActivity,
  loadDashboard,
  loadSites,
  logout,
  navigate,
}: {
  loadActivity: () => Promise<SiteActivityResponse>;
  loadDashboard: () => Promise<DashboardResponse>;
  loadSites: () => Promise<SitesPageResponse>;
  logout: () => Promise<void>;
  navigate?: (destination: string) => void;
}) {
  const [loadState, setLoadState] = useState<SiteActivityLoadState | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const lifecycle = { active: true };
    const isActive = () => lifecycle.active;
    const load = async () => {
      const dashboard = await loadDashboard();
      if (!isActive()) return;
      const [activity, sitesPage] = await Promise.all([
        loadActivity(),
        loadSites(),
      ]);
      if (!isActive()) return;
      const visibleSite = sitesPage.sites.find(
        (site) => site.id === activity.site.id,
      );
      if (visibleSite?.name !== activity.site.name)
        throw new Error('Inconsistent Site context');
      setLoadState({
        status: 'loaded',
        attempt,
        loadActivity,
        loadDashboard,
        loadSites,
        dashboard,
        activity,
        sitesPage,
      });
    };
    void load().catch(() => {
      if (isActive())
        setLoadState({
          status: 'failed',
          attempt,
          loadActivity,
          loadDashboard,
          loadSites,
        });
    });
    return () => {
      lifecycle.active = false;
    };
  }, [attempt, loadActivity, loadDashboard, loadSites]);

  const currentState =
    loadState?.attempt === attempt &&
    loadState.loadActivity === loadActivity &&
    loadState.loadDashboard === loadDashboard &&
    loadState.loadSites === loadSites
      ? loadState
      : null;

  if (!currentState)
    return (
      <main className="grid min-h-screen place-items-center bg-surface p-5 text-content">
        <p className="text-sm text-content-muted" role="status">
          Loading site…
        </p>
      </main>
    );

  if (currentState.status === 'failed')
    return (
      <main className="grid min-h-screen place-items-center bg-surface p-5 text-content">
        <div className="flex items-center gap-4 max-md:flex-col max-md:items-start">
          <p className="text-sm text-danger" role="alert">
            We couldn't load this site.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setAttempt((value) => value + 1);
            }}
          >
            Retry
          </Button>
        </div>
      </main>
    );

  const { activity, dashboard, sitesPage } = currentState;
  const selectedSite = sitesPage.sites.find(
    (site) => site.id === activity.site.id,
  );
  const activityDestination = `/sites/${encodeURIComponent(activity.site.id)}/activity`;

  return (
    <ApplicationShell
      activePage="Sites"
      headerActions={
        <>
          {selectedSite?.memberCount ? (
            <SiteMemberPreview site={selectedSite} />
          ) : null}
          <div className="flex overflow-hidden rounded border border-control-border">
            <button
              aria-label="Share site"
              className="min-h-9 px-4 text-[14px] disabled:cursor-not-allowed disabled:text-content-muted"
              disabled
              type="button"
            >
              Share
            </button>
            <button
              aria-label="Share options"
              className="grid size-9 place-items-center border-l border-control-border disabled:cursor-not-allowed disabled:text-content-muted"
              disabled
              type="button"
            >
              <AppSymbol className="!size-4 text-[18px]" weight={100}>
                keyboard_arrow_down
              </AppSymbol>
            </button>
          </div>
          <span aria-hidden="true" className="h-8 w-px bg-control-border" />
          <button
            aria-label="Notifications"
            className="grid size-9 place-items-center disabled:cursor-not-allowed disabled:text-content-muted"
            disabled
            type="button"
          >
            <AppSymbol weight={100}>notifications_none</AppSymbol>
          </button>
          <button
            aria-label="Site settings"
            className="grid size-9 place-items-center disabled:cursor-not-allowed disabled:text-content-muted"
            disabled
            type="button"
          >
            <AppSymbol weight={100}>tune</AppSymbol>
          </button>
        </>
      }
      headerLeading={
        <nav aria-label="Site breadcrumb">
          <ol className="flex min-w-0 items-center gap-4 text-[14px]">
            <li>
              <a
                className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                href="/sites"
                onClick={(event) => {
                  if (!navigate) return;
                  event.preventDefault();
                  navigate('/sites');
                }}
              >
                Sites
              </a>
            </li>
            <li aria-hidden="true">
              <AppSymbol className="!size-4 text-[18px]" weight={100}>
                chevron_right
              </AppSymbol>
            </li>
            <li
              aria-current="page"
              className="min-w-0 truncate font-semibold"
              title={activity.site.name}
            >
              {activity.site.name}
            </li>
          </ol>
        </nav>
      }
      loadDashboard={loadDashboard}
      loadErrorMessage="We couldn't load your account. Please try again."
      logout={logout}
      navigate={navigate}
      currentSiteId={activity.site.id}
      pageHeading={activity.site.name}
      preloadedViewer={dashboard.viewer}
      siteNavigation={sitesPage.sites}
      workspaceName={sitesPage.organizationName}
    >
      <section className="px-8 py-8 max-md:px-5">
        <nav
          aria-label="Site sections"
          className="flex min-h-[54px] max-w-full items-end gap-8 overflow-x-auto rounded border border-site-card-border bg-surface px-6 shadow-site-card"
        >
          <span className="flex min-h-[53px] shrink-0 items-center gap-2 border-b-2 border-action-primary px-1 text-[14px] font-medium">
            <a
              aria-current="page"
              className="flex min-h-[53px] items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
              href={activityDestination}
              onClick={(event) => {
                if (!navigate) return;
                event.preventDefault();
                navigate(activityDestination);
              }}
            >
              <AppSymbol className="!size-5 text-[20px]" weight={100}>
                space_dashboard
              </AppSymbol>
              Activity
            </a>
            <AppSymbol
              className="pointer-events-none !size-4 text-[18px]"
              weight={100}
            >
              more_horiz
            </AppSymbol>
          </span>
          <span
            aria-disabled="true"
            className="flex min-h-[53px] shrink-0 items-center gap-2 text-[14px] text-content-muted"
          >
            <AppSymbol className="!size-5 text-[20px]" weight={100}>
              map
            </AppSymbol>
            Allocations
          </span>
          <span
            aria-disabled="true"
            className="flex min-h-[53px] shrink-0 items-center gap-2 text-[14px] text-content-muted"
          >
            <AppSymbol className="!size-5 text-[20px]" weight={100}>
              calendar_month
            </AppSymbol>
            Signage Schedule
          </span>
        </nav>
        <section aria-labelledby="site-summary-heading">
          <h2 id="site-summary-heading" className="sr-only">
            Site summary
          </h2>
          <div className="mt-8 grid grid-cols-4 gap-6 max-xl:grid-cols-2 max-md:grid-cols-1">
            {Array.from({ length: 4 }, (_, index) => (
              <article
                key={index}
                className="min-h-[212px] overflow-hidden rounded-lg border border-site-card-border bg-surface shadow-site-card"
              >
                <h2 className="border-b border-control-border px-6 py-5 text-[16px] font-normal">
                  Widget title
                </h2>
              </article>
            ))}
          </div>
        </section>
        <section
          aria-labelledby="site-activity-heading"
          className="mt-8 max-w-[390px] overflow-hidden rounded-lg border border-site-card-border bg-surface shadow-site-card max-md:max-w-none"
        >
          <h2
            id="site-activity-heading"
            className="border-b border-control-border px-6 py-5 text-[16px] font-semibold"
          >
            Activity
          </h2>
          <div className="grid min-h-[320px] place-items-center px-6 text-center text-sm text-content-muted">
            Site activity will appear here.
          </div>
        </section>
      </section>
    </ApplicationShell>
  );
}
