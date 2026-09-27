import type { LibraryFilesApi } from './library-files-api.js';
import type { LibraryPlan } from '@hansel/contracts';
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
  CommitAllocationPlanDraftRequest,
  SignageScheduleResponse,
  SignType,
  Sign,
  SiteActivityPageResponse,
  SiteActivityItem,
} from '@hansel/contracts';
import type { PlanSignsApi } from './plan-signs-api.js';
import {
  ApplicationShell,
  AppSymbol,
  NotificationSymbol,
} from '../application-shell/ApplicationShell.js';
import { Button } from '../design-system/index.js';
import { relativeTime } from './SiteCollection.js';
import { SiteShareControls } from './SiteShareControls.js';
import { AddPlansModal } from './AddPlansModal.js';
import { AllocationPlanViewer } from './AllocationPlanViewer.js';
import { SignageSchedule } from './SignageSchedule.js';
import { SiteActivityFeed } from './SiteActivityFeed.js';

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
      selectedSite: SitesPageResponse['sites'][number];
      allocationPlans: AllocationPlansResponse;
      signageSchedule: SignageScheduleResponse;
      activityPage: SiteActivityPageResponse | null;
    })
  | (SiteDetailsRequest & { status: 'failed' });

interface SharedSiteDetailsProps {
  loadDashboard: () => Promise<DashboardResponse>;
  loadSite: () => Promise<SiteActivityResponse>;
  loadSites: () => Promise<SitesPageResponse>;
  logout: () => Promise<void>;
  navigate?: ((destination: string) => void) | undefined;
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
  commitAllocationPlanDraft?: (
    input: CommitAllocationPlanDraftRequest,
  ) => Promise<void>;
  library?: {
    files: LibraryFilesApi;
    create: (input: LibraryPlan) => Promise<void>;
  };
  previewPlanId?: string;
  planSignsApi?: PlanSignsApi;
  loadAllocationPlanContent?: (
    fileId?: string,
    signal?: AbortSignal,
  ) => Promise<Blob>;
  loadSignageSchedule?: () => Promise<SignageScheduleResponse>;
  createSignType?: (name: string) => Promise<SignType>;
  updateSignType?: (type: SignType, name: string) => Promise<SignType>;
  createSign?: (typeId: string, code: string) => Promise<Sign>;
  updateSign?: (
    sign: Sign,
    field: 'code' | 'quantity' | 'location' | 'content' | 'comments',
    value: string | number,
  ) => Promise<Sign>;
  loadSiteActivityPage?: (
    cursor: string | null,
  ) => Promise<SiteActivityPageResponse | null>;
  createSiteComment?: (text: string) => Promise<SiteActivityItem>;
  isSiteActivityNotFound?: (error: unknown) => boolean;
  preloadedDashboard?: DashboardResponse;
}

export function AllocationPlanCollection({
  now = new Date(),
  plans,
  siteId,
  navigate,
}: {
  now?: Date;
  plans: readonly AllocationPlan[];
  siteId: string;
  navigate?: ((destination: string) => void) | undefined;
}) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visiblePlans = plans.filter((plan) =>
    (plan.name ?? plan.filename ?? '')
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <label className="relative block w-full max-w-[280px]">
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
        <div
          className="flex shrink-0 items-center gap-2"
          role="group"
          aria-label="Plan view"
        >
          {(['grid', 'list'] as const).map((candidate) => (
            <button
              aria-label={`${candidate === 'grid' ? 'Grid' : 'List'} view`}
              aria-pressed={view === candidate}
              className="grid size-9 place-items-center rounded text-content-muted hover:bg-[#f7f7f7] aria-pressed:text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              key={candidate}
              onClick={() => {
                setView(candidate);
              }}
              type="button"
            >
              <AppSymbol className="!size-5 text-[21px]" weight={100}>
                {candidate === 'grid' ? 'grid_view' : 'format_list_bulleted'}
              </AppSymbol>
            </button>
          ))}
        </div>
      </div>
      {view === 'grid' ? (
        visiblePlans.length === 0 ? (
          <p className="py-8 text-sm text-content-muted">
            No plans match your search.
          </p>
        ) : (
          <ul
            aria-label="Allocation Plans"
            className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(min(100%,275px),275px))] gap-4"
          >
            {visiblePlans.map((plan) => (
              <li
                className="group relative min-h-[73px] min-w-0 rounded border border-control-border bg-surface transition-shadow duration-150 ease-out motion-reduce:transition-none hover:shadow-[0_3px_3px_rgba(0,0,0,0.16)] focus-within:shadow-[0_3px_3px_rgba(0,0,0,0.16)]"
                key={plan.id}
              >
                <a
                  aria-label={plan.name ?? plan.filename}
                  className="block min-w-0 rounded px-[15px] py-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  href={`/sites/${siteId}/allocations/${plan.id}`}
                  onClick={(event) => {
                    /* v8 ignore next -- the href is the tested no-JavaScript fallback */
                    if (!navigate) return;
                    event.preventDefault();
                    navigate(event.currentTarget.pathname);
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2 pr-5">
                    <span className="grid size-5 shrink-0 place-items-center rounded-sm bg-site-symbol text-on-action">
                      <AppSymbol className="!size-4 text-[15px]" weight={100}>
                        layers
                      </AppSymbol>
                    </span>
                    <span
                      className="truncate text-[14px] font-normal leading-5"
                      title={plan.name ?? plan.filename}
                    >
                      {plan.name ?? plan.filename}
                    </span>
                  </span>
                  <span className="mt-1 block text-[12px] leading-[17px] text-site-meta">
                    {plan.createdAt === plan.modifiedAt ? 'Created' : 'Edited'}{' '}
                    {relativeTime(plan.modifiedAt, now)}
                  </span>
                </a>
                <AppSymbol
                  className="pointer-events-none absolute right-2 top-[17px] !size-4 text-[18px] text-content-muted opacity-0 transition-opacity duration-150 ease-out motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100"
                  weight={100}
                >
                  more_vert
                </AppSymbol>
              </li>
            ))}
          </ul>
        )
      ) : (
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
                        <a
                          className="min-w-0 truncate font-medium"
                          href={`/sites/${siteId}/allocations/${plan.id}`}
                          onClick={(event) => {
                            /* v8 ignore next -- the href is the tested no-JavaScript fallback */
                            if (!navigate) return;
                            event.preventDefault();
                            navigate(event.currentTarget.pathname);
                          }}
                          title={plan.name ?? plan.filename}
                        >
                          {plan.name ?? plan.filename}
                        </a>
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
      )}
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
  commitAllocationPlanDraft,
  previewPlanId,
  loadAllocationPlanContent,
  planSignsApi,
  loadSignageSchedule,
  createSignType,
  updateSignType,
  createSign,
  updateSign,
  loadSiteActivityPage,
  createSiteComment,
  isSiteActivityNotFound,
  preloadedDashboard,
  library,
}: SharedSiteDetailsProps & {
  activeSection: 'activity' | 'allocations' | 'signage';
}) {
  const [loadState, setLoadState] = useState<SiteDetailsLoadState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [showAddPlans, setShowAddPlans] = useState(false);
  const [activityAccessFailed, setActivityAccessFailed] = useState(false);

  useEffect(() => {
    const lifecycle = { active: true };
    const isActive = () => lifecycle.active;
    const load = async () => {
      const dashboard = await loadDashboard();
      if (!isActive()) return;
      const [
        siteContext,
        sitesPage,
        allocationPlans,
        signageSchedule,
        activityPage,
      ] = await Promise.all([
        loadSite(),
        loadSites(),
        activeSection === 'allocations' && loadAllocationPlans
          ? loadAllocationPlans()
          : Promise.resolve({ canAddPlans: false, plans: [] }),
        activeSection === 'signage' && loadSignageSchedule
          ? loadSignageSchedule()
          : Promise.resolve({ canManageSigns: false, signTypes: [] }),
        activeSection === 'activity' && loadSiteActivityPage
          ? loadSiteActivityPage(null)
          : Promise.resolve({ items: [], nextCursor: null }),
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
        selectedSite: visibleSite,
        allocationPlans,
        signageSchedule,
        activityPage,
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
    loadSignageSchedule,
    loadSiteActivityPage,
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

  if (!currentState && !preloadedDashboard)
    return (
      <main className="grid min-h-screen place-items-center bg-surface p-5 text-content">
        <p className="text-sm text-content-muted" role="status">
          Loading site…
        </p>
      </main>
    );

  if (!currentState)
    return (
      <ApplicationShell
        activePage="Sites"
        headerActions={<NotificationSymbol />}
        loadDashboard={loadDashboard}
        loadErrorMessage="We couldn't load your account. Please try again."
        logout={logout}
        navigate={navigate}
        preloadedDashboard={preloadedDashboard}
      >
        <section className="grid min-h-[calc(100vh-68px)] place-items-center p-5">
          <p className="text-sm text-content-muted" role="status">
            Loading site…
          </p>
        </section>
      </ApplicationShell>
    );

  if (currentState.status === 'failed' && !preloadedDashboard)
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

  if (currentState.status === 'failed')
    return (
      <ApplicationShell
        activePage="Sites"
        headerActions={<NotificationSymbol />}
        loadDashboard={loadDashboard}
        loadErrorMessage="We couldn't load your account. Please try again."
        logout={logout}
        navigate={navigate}
        preloadedDashboard={preloadedDashboard}
      >
        <section className="grid min-h-[calc(100vh-68px)] place-items-center p-5">
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
        </section>
      </ApplicationShell>
    );

  if (activityAccessFailed)
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
              setActivityAccessFailed(false);
              setAttempt((value) => value + 1);
            }}
          >
            Retry
          </Button>
        </div>
      </main>
    );

  const {
    dashboard,
    siteContext,
    sitesPage,
    selectedSite,
    allocationPlans,
    signageSchedule,
    activityPage,
  } = currentState;
  const siteId = encodeURIComponent(siteContext.site.id);
  const activityDestination = `/sites/${siteId}/activity`;
  const allocationsDestination = `/sites/${siteId}/allocations`;
  const signageDestination = `/sites/${siteId}/signage-schedule`;

  return (
    <ApplicationShell
      activePage="Sites"
      siteHeader
      headerActions={
        <SiteShareControls
          memberPreview={selectedSite.memberPreview}
          memberCount={selectedSite.memberCount}
        />
      }
      headerLeading={
        <nav aria-label="Site breadcrumb">
          <ol className="flex min-w-0 items-center gap-4 text-[14px] leading-5">
            <li className="flex shrink-0 items-center">
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
            <li aria-hidden="true" className="flex shrink-0 items-center">
              <AppSymbol className="!size-4 text-[18px]" weight={100}>
                chevron_right
              </AppSymbol>
            </li>
            <li
              aria-current={previewPlanId ? undefined : 'page'}
              className={`min-w-0 truncate ${previewPlanId ? '' : 'font-semibold'}`}
              title={siteContext.site.name}
            >
              {siteContext.site.name}
            </li>
            {previewPlanId && (
              <>
                <li aria-hidden="true" className="flex shrink-0 items-center">
                  <AppSymbol className="!size-4 text-[18px]">
                    chevron_right
                  </AppSymbol>
                </li>
                <li aria-current="page" className="truncate font-semibold">
                  {allocationPlans.plans.find(
                    (plan) => plan.id === previewPlanId,
                  )?.name ??
                    allocationPlans.plans.find(
                      (plan) => plan.id === previewPlanId,
                    )?.filename}
                </li>
              </>
            )}
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
          : activeSection === 'signage'
            ? `${siteContext.site.name} Signage Schedule`
            : siteContext.site.name
      }
      preloadedDashboard={dashboard}
      siteNavigation={sitesPage.sites}
      workspaceName={sitesPage.organizationName}
    >
      <section
        className={`min-h-[calc(100vh-64px)] bg-[#fafafa] px-8 max-md:px-5 ${previewPlanId ? '' : 'pb-8'}`}
      >
        <nav
          aria-label="Site sections"
          className="-mx-8 flex min-h-[54px] items-center gap-8 overflow-x-auto border-b border-site-card-border bg-surface px-6 max-md:-mx-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>span]:min-h-[51px] [&>span>a]:min-h-[51px]"
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
          <a
            aria-current={activeSection === 'signage' ? 'page' : undefined}
            className={`flex min-h-[53px] shrink-0 items-center gap-2 text-[14px] ${activeSection === 'signage' ? 'border-b-2 border-action-primary font-medium text-content' : 'text-content-muted'}`}
            href={signageDestination}
            onClick={(event) => {
              if (!navigate) return;
              event.preventDefault();
              navigate(signageDestination);
            }}
          >
            <AppSymbol className="!size-5 text-[20px]" weight={100}>
              calendar_month
            </AppSymbol>
            Signage Schedule
          </a>
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
              className="mt-7 w-full max-w-[375px] bg-surface"
            >
              <h2
                id="site-activity-heading"
                className="px-5 pt-4 text-[12px] font-semibold leading-[18px] text-[#0f172a]"
              >
                Activity
              </h2>
              {activityPage ? (
                <SiteActivityFeed
                  viewer={dashboard.viewer}
                  initial={activityPage}
                  loadOlder={async (cursor) => {
                    const page = loadSiteActivityPage
                      ? await loadSiteActivityPage(cursor)
                      : null;
                    if (!page) throw new Error('Site activity is unavailable');
                    return page;
                  }}
                  submitComment={(text) => {
                    if (!createSiteComment)
                      return Promise.reject(
                        new Error('Site comments are unavailable'),
                      );
                    return createSiteComment(text);
                  }}
                  onUnavailable={(error) => {
                    if (!isSiteActivityNotFound?.(error)) return false;
                    setActivityAccessFailed(true);
                    return true;
                  }}
                />
              ) : (
                <div className="grid min-h-[320px] place-items-center px-6 text-center text-sm text-content-muted">
                  Site activity will appear here.
                </div>
              )}
            </section>
          </>
        ) : activeSection === 'signage' &&
          createSignType &&
          updateSignType &&
          createSign &&
          updateSign ? (
          <SignageSchedule
            initial={signageSchedule}
            createType={createSignType}
            updateType={updateSignType}
            createSign={createSign}
            updateSign={updateSign}
          />
        ) : previewPlanId && loadAllocationPlanContent ? (
          (() => {
            const plan = allocationPlans.plans.find(
              (candidate) => candidate.id === previewPlanId,
            );
            return plan ? (
              <AllocationPlanViewer
                key={plan.id}
                loadContent={loadAllocationPlanContent}
                planSignsApi={planSignsApi}
                plan={plan}
                plans={allocationPlans.plans}
                onSelectPlan={(id) => {
                  const destination = `/sites/${siteId}/allocations/${id}`;
                  if (navigate) navigate(destination);
                  else window.location.assign(destination);
                }}
              />
            ) : (
              <p className="grid min-h-[420px] place-items-center text-sm text-content-muted">
                We couldn’t display this plan. Please try again.
              </p>
            );
          })()
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
              <AllocationPlanCollection
                navigate={navigate}
                plans={allocationPlans.plans}
                siteId={siteContext.site.id}
              />
            </div>
          </section>
        )}
      </section>
      {showAddPlans &&
      createAllocationPlanUploadBatch &&
      uploadAllocationPlan &&
      finalizeAllocationPlanUpload ? (
        <AddPlansModal
          {...(library ? { library } : {})}
          createBatch={createAllocationPlanUploadBatch}
          upload={uploadAllocationPlan}
          finalize={finalizeAllocationPlanUpload}
          {...(commitAllocationPlanDraft
            ? { commit: commitAllocationPlanDraft }
            : {})}
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

export function SiteSignageSchedule(props: SharedSiteDetailsProps) {
  return <SiteDetails {...props} activeSection="signage" />;
}
