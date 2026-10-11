/** @spec dashboard-home REQ-001..REQ-017; dashboard-logout REQ-001..REQ-004, REQ-010; sites-empty-state REQ-002..REQ-004, REQ-008..REQ-012; sites-populated-state REQ-005..REQ-008, REQ-018, REQ-020..REQ-022; site-details-activity-shell REQ-005, REQ-007, REQ-014..REQ-017 */
import { useEffect, useState, type ReactNode } from 'react';
import type { DashboardResponse } from '@hansel/contracts';
import { Button } from '../design-system/index.js';
import { AccountSettingsModal } from './AccountSettingsModal.js';
import { AppSymbol, NotificationSymbol } from './SidebarPrimitives.js';
import { Sidebar } from './Sidebar.js';
export { AppSymbol, NotificationSymbol } from './SidebarPrimitives.js';

export interface ApplicationShellProps {
  activePage: 'Dashboard' | 'Sites' | 'Files';
  children: ReactNode;
  headerActions: ReactNode;
  headerLeading?: ReactNode;
  siteHeader?: boolean;
  loadDashboard: () => Promise<DashboardResponse>;
  loadErrorMessage: string;
  logout: () => Promise<void>;
  navigate?: ((destination: string) => void) | undefined;
  pageHeading?: string | undefined;
  preloadedViewer?: DashboardResponse['viewer'] | undefined;
  preloadedDashboard?: DashboardResponse | undefined;
  currentSiteId?: string | undefined;
  siteNavigation?: readonly { id: string; name: string }[] | undefined;
  workspaceName?: string | undefined;
  onCreateSite?: (() => void) | undefined;
  createSiteDisabled?: boolean | undefined;
}

export function ApplicationShell({
  activePage,
  children,
  headerActions,
  headerLeading,
  siteHeader = false,
  loadDashboard,
  loadErrorMessage,
  logout,
  navigate,
  pageHeading,
  preloadedViewer,
  preloadedDashboard,
  currentSiteId,
  siteNavigation,
  workspaceName,
  onCreateSite,
  createSiteDisabled = false,
}: ApplicationShellProps) {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (preloadedDashboard || preloadedViewer) return;
    let active = true;
    setLoadError(false);
    setDashboard(null);
    void loadDashboard()
      .then((response) => {
        if (active) setDashboard(response);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt, loadDashboard, preloadedDashboard, preloadedViewer]);

  const displayedViewer =
    preloadedDashboard?.viewer ?? preloadedViewer ?? dashboard?.viewer;
  const organization =
    preloadedDashboard?.organization ?? dashboard?.organization;
  const organizationName = organization?.name ?? workspaceName;
  const canCreateSiteFromSidebar = Boolean(onCreateSite ?? navigate);
  const canManageOrganization = ['Owner', 'Administrator', 'Editor'].includes(
    displayedViewer?.roleLabel ?? '',
  );

  return (
    <main className="flex min-h-screen bg-surface text-content md:h-dvh md:overflow-hidden max-md:flex-col max-md:overflow-x-clip">
      <h1 className="sr-only">{pageHeading ?? activePage}</h1>
      <Sidebar
        activePage={activePage}
        currentSiteId={currentSiteId}
        siteNavigation={siteNavigation}
        organizationName={organizationName}
        organization={organization}
        displayedViewer={displayedViewer}
        canManageOrganization={canManageOrganization}
        canCreateSiteFromSidebar={canCreateSiteFromSidebar}
        createSiteDisabled={createSiteDisabled}
        loadError={loadError}
        navigate={navigate}
        onCreateSite={onCreateSite}
        onOpenSettings={() => setSettingsOpen(true)}
        settingsOpen={settingsOpen}
        logout={logout}
      />
      <section className="min-w-0 flex-1 md:flex md:min-h-0 md:flex-col [&>header]:shrink-0">
        <header
          className={`flex items-center gap-5 border-b border-[#e5e5e5] px-8 ${siteHeader ? 'h-16 max-w-full justify-between max-md:h-auto max-md:min-h-16 max-md:flex-wrap max-md:px-5 max-md:py-3' : headerLeading ? 'min-h-[68px] max-w-full justify-between max-md:min-h-14 max-md:flex-wrap max-md:px-5 max-md:py-3' : 'h-[68px] justify-end max-md:h-14 max-md:px-5'}`}
        >
          {headerLeading ? (
            <div className="min-w-0 flex-1">{headerLeading}</div>
          ) : null}
          <div
            className={`flex max-w-full shrink-0 flex-wrap items-center justify-end gap-5 max-md:gap-2 ${siteHeader ? 'max-md:w-full' : ''}`}
          >
            {headerActions}
          </div>
        </header>
        <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
          {loadError ? (
            <div className="mx-10 mt-8 flex items-center gap-4 max-md:mx-5 max-md:flex-col max-md:items-start">
              <p role="alert" className="text-danger">
                {loadErrorMessage}
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
          ) : null}
          {children}
        </div>
      </section>
      {settingsOpen && displayedViewer ? (
        <AccountSettingsModal
          viewer={displayedViewer}
          onClose={() => {
            setSettingsOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}
