/** @spec site-details-activity-shell REQ-001..REQ-021 @spec site-allocation-plans-empty-state REQ-001..REQ-023 @figma 2030:3333, 2037:1019 */
import { useEffect, useState } from 'react';
import type {
  DashboardResponse,
  SiteActivityResponse,
  SitesPageResponse,
  AllocationPlansResponse,
  CreateAllocationPlanUploadBatchRequest,
  CreateAllocationPlanUploadBatchResponse,
  AllocationPlan,
} from '@hansel/contracts';
import {
  ApplicationShell,
  AppSymbol,
} from '../application-shell/ApplicationShell.js';
import { Button } from '../design-system/index.js';
import { relativeTime, SiteMemberPreview } from './SiteCollection.js';
import { AddPlansModal } from './AddPlansModal.js';

interface SiteDetailsRequest {
  attempt: number;
  loadDashboard: () => Promise<DashboardResponse>;
  loadSite: () => Promise<SiteActivityResponse>;
  loadSites: () => Promise<SitesPageResponse>;
}

type SiteDetailsLoadState =
  | (SiteDetailsRequest & {
      status: 'loaded';
      dashboard: DashboardResponse;
      siteContext: SiteActivityResponse;
      sitesPage: SitesPageResponse;
      allocationPlans: AllocationPlansResponse;
    })
  | (SiteDetailsRequest & { status: 'failed' });

interface SharedSiteDetailsProps {
  loadDashboard: () => Promise<DashboardResponse>;
  loadSite: () => Promise<SiteActivityResponse>;
  loadSites: () => Promise<SitesPageResponse>;
  logout: () => Promise<void>;
  navigate?: (destination: string) => void;
  loadAllocationPlans?: () => Promise<AllocationPlansResponse>;
  createAllocationPlanUploadBatch?: (
    input: CreateAllocationPlanUploadBatchRequest,
  ) => Promise<CreateAllocationPlanUploadBatchResponse>;
  uploadAllocationPlan?: (
    url: string,
    file: File,
    headers: Record<string, string>,
    options?: { onProgress: (percentage: number) => void; signal: AbortSignal },
  ) => Promise<void>;
  finalizeAllocationPlanUpload?: (uploadId: string) => Promise<void>;
}

export function AllocationPlanCollection({
  now = new Date(),
  plans,
}: {
  now?: Date;
  plans: readonly AllocationPlan[];
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visiblePlans = plans.filter((plan) =>
    plan.filename.toLocaleLowerCase().includes(normalizedQuery),
  );

  return (
    <>
      <label className="relative block max-w-[280px]">
        <span className="sr-only">Search plans</span>
        <AppSymbol
          className="pointer-events-none absolute left-3 top-1/2 !size-4 -translate-y-1/2 text-[18px] text-content-muted"
          weight={100}
        >
          search
        </AppSymbol>
        <input
          className="min-h-10 w-full rounded border border-control-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-focus"
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Search plans"
          type="search"
          value={query}
        />
      </label>
      <div className="mt-5 max-w-full overflow-x-auto">
        <table
          aria-label="Allocation Plans"
          className="w-full min-w-[620px] table-fixed border-separate border-spacing-0 text-left"
        >
          <thead className="text-[12px] font-normal text-site-meta">
            <tr>
              <th className="w-1/2 py-2 font-normal" scope="col">
                Name
              </th>
              <th className="w-1/4 px-3 py-2 font-normal" scope="col">
                <span className="inline-flex items-center gap-1">
                  <AppSymbol className="!size-3 text-[14px]" weight={100}>
                    arrow_downward
                  </AppSymbol>
                  Last modified
                </span>
              </th>
              <th className="w-1/4 px-3 py-2 font-normal" scope="col">
                Created
              </th>
            </tr>
          </thead>
          <tbody>
            {visiblePlans.length === 0 ? (
              <tr>
                <td className="py-8 text-sm text-content-muted" colSpan={3}>
                  No plans match your search.
                </td>
              </tr>
            ) : (
              visiblePlans.map((plan) => (
                <tr className="text-[14px]" key={plan.id}>
                  <td className="h-12 py-1 pr-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <AppSymbol
                        className="!size-5 text-[20px] text-content-muted"
                        weight={100}
                      >
                        {plan.mediaType === 'application/pdf'
                          ? 'picture_as_pdf'
                          : 'image'}
                      </AppSymbol>
                      <span
                        className="min-w-0 truncate font-medium"
                        title={plan.filename}
                      >
                        {plan.filename}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-1 text-[12px] text-site-row">
                    {relativeTime(plan.modifiedAt, now)}
                  </td>
                  <td className="px-3 py-1 text-[12px] text-site-row">
                    {relativeTime(plan.createdAt, now)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SiteDetails({
  activeSection,
  loadDashboard,
  loadSite,
  loadSites,
  logout,
  navigate,
  loadAllocationPlans,
  createAllocationPlanUploadBatch,
  uploadAllocationPlan,
  finalizeAllocationPlanUpload,
}: SharedSiteDetailsProps & { activeSection: 'activity' | 'allocations' }) {
  const [loadState, setLoadState] = useState<SiteDetailsLoadState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [showAddPlans, setShowAddPlans] = useState(false);

  useEffect(() => {
    const lifecycle = { active: true };
    const isActive = () => lifecycle.active;
    const load = async () => {
      const dashboard = await loadDashboard();
      if (!isActive()) return;
      const [siteContext, sitesPage, allocationPlans] = await Promise.all([
        loadSite(),
        loadSites(),
        activeSection === 'allocations' && loadAllocationPlans
          ? loadAllocationPlans()
          : Promise.resolve({ canAddPlans: false, plans: [] }),
      ]);
      if (!isActive()) return;
      const visibleSite = sitesPage.sites.find(
        (site) => site.id === siteContext.site.id,
      );
      if (visibleSite?.name !== siteContext.site.name)
        throw new Error('Inconsistent Site context');
      setLoadState({
        status: 'loaded',
        attempt,
        loadDashboard,
        loadSite,
        loadSites,
        dashboard,
        siteContext,
        sitesPage,
        allocationPlans,
      });
    };
    void load().catch(() => {
      if (isActive())
        setLoadState({
          status: 'failed',
          attempt,
          loadDashboard,
          loadSite,
          loadSites,
        });
    });
    return () => {
      lifecycle.active = false;
    };
  }, [
    activeSection,
    attempt,
    loadAllocationPlans,
    loadDashboard,
    loadSite,
    loadSites,
  ]);

  const currentState =
    loadState?.attempt === attempt &&
    loadState.loadDashboard === loadDashboard &&
    loadState.loadSite === loadSite &&
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

  const { dashboard, siteContext, sitesPage, allocationPlans } = currentState;
  const selectedSite = sitesPage.sites.find(
    (site) => site.id === siteContext.site.id,
  );
  const siteId = encodeURIComponent(siteContext.site.id);
  const activityDestination = `/sites/${siteId}/activity`;
  const allocationsDestination = `/sites/${siteId}/allocations`;

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
              title={siteContext.site.name}
            >
              {siteContext.site.name}
            </li>
          </ol>
        </nav>
      }
      loadDashboard={loadDashboard}
      loadErrorMessage="We couldn't load your account. Please try again."
      logout={logout}
      navigate={navigate}
      currentSiteId={siteContext.site.id}
      pageHeading={
        activeSection === 'allocations'
          ? `${siteContext.site.name} Allocation Plans`
          : siteContext.site.name
      }
      preloadedViewer={dashboard.viewer}
      siteNavigation={sitesPage.sites}
      workspaceName={sitesPage.organizationName}
    >
      <section className="px-8 py-8 max-md:px-5">
        <nav
          aria-label="Site sections"
          className="flex min-h-[54px] max-w-full items-end gap-8 overflow-x-auto rounded border border-site-card-border bg-surface px-6 shadow-site-card"
        >
          <span
            className={`flex min-h-[53px] shrink-0 items-center gap-2 px-1 text-[14px] font-medium ${activeSection === 'activity' ? 'border-b-2 border-action-primary' : ''}`}
          >
            <a
              aria-current={activeSection === 'activity' ? 'page' : undefined}
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
          </span>
          <span
            className={`flex min-h-[53px] shrink-0 items-center gap-2 px-1 text-[14px] font-medium ${activeSection === 'allocations' ? 'border-b-2 border-action-primary' : ''}`}
          >
            <a
              aria-current={
                activeSection === 'allocations' ? 'page' : undefined
              }
              className="flex min-h-[53px] items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
              href={allocationsDestination}
              onClick={(event) => {
                if (!navigate) return;
                event.preventDefault();
                navigate(allocationsDestination);
              }}
            >
              <AppSymbol className="!size-5 text-[20px]" weight={100}>
                map
              </AppSymbol>
              Allocations
            </a>
          </span>
          <AppSymbol
            className="pointer-events-none !size-4 text-[18px]"
            weight={100}
          >
            more_horiz
          </AppSymbol>
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
        {activeSection === 'activity' ? (
          <>
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
          </>
        ) : allocationPlans.plans.length === 0 ? (
          <section
            aria-labelledby="no-allocation-plans-heading"
            className="grid min-h-[calc(100vh-220px)] place-items-center py-16 text-center max-md:min-h-[420px]"
          >
            <div className="flex flex-col items-center">
              <AppSymbol className="!size-12 text-[44px]" weight={100}>
                map
              </AppSymbol>
              <h2
                id="no-allocation-plans-heading"
                className="mt-3 text-[16px] font-semibold"
              >
                No plans
              </h2>
              <p className="mt-2 text-[15px] leading-[19px]">
                <span className="block">Upload an architectural plan</span>
                <span className="block">
                  or plot your signage on Google Maps
                </span>
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-4">
                <Button
                  className="gap-2"
                  disabled={
                    !allocationPlans.canAddPlans ||
                    !createAllocationPlanUploadBatch ||
                    !uploadAllocationPlan ||
                    !finalizeAllocationPlanUpload
                  }
                  onClick={() => {
                    setShowAddPlans(true);
                  }}
                  type="button"
                >
                  <AppSymbol className="!size-4 text-[18px]" weight={100}>
                    add
                  </AppSymbol>
                  Add plan
                </Button>
                <Button disabled type="button" variant="secondary">
                  Use Google Maps
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-8" aria-labelledby="allocation-plans-heading">
            <div className="flex items-center justify-between gap-4">
              <h2
                className="text-lg font-semibold"
                id="allocation-plans-heading"
              >
                Allocation Plans
              </h2>
              <Button
                className="gap-2"
                disabled={!allocationPlans.canAddPlans}
                onClick={() => {
                  setShowAddPlans(true);
                }}
                type="button"
              >
                <AppSymbol className="!size-4 text-[18px]" weight={100}>
                  add
                </AppSymbol>
                Add plan
              </Button>
            </div>
            <div className="mt-5">
              <AllocationPlanCollection plans={allocationPlans.plans} />
            </div>
          </section>
        )}
      </section>
      {showAddPlans &&
      createAllocationPlanUploadBatch &&
      uploadAllocationPlan &&
      finalizeAllocationPlanUpload ? (
        <AddPlansModal
          createBatch={createAllocationPlanUploadBatch}
          upload={uploadAllocationPlan}
          finalize={finalizeAllocationPlanUpload}
          onClose={() => {
            setShowAddPlans(false);
          }}
          onComplete={() => {
            setShowAddPlans(false);
            setAttempt((value) => value + 1);
          }}
        />
      ) : null}
    </ApplicationShell>
  );
}

type SiteActivityProps = Omit<SharedSiteDetailsProps, 'loadSite'> & {
  loadActivity: () => Promise<SiteActivityResponse>;
};

export function SiteActivity({ loadActivity, ...props }: SiteActivityProps) {
  return (
    <SiteDetails {...props} activeSection="activity" loadSite={loadActivity} />
  );
}

export function SiteAllocationPlans(props: SharedSiteDetailsProps) {
  return <SiteDetails {...props} activeSection="allocations" />;
}
