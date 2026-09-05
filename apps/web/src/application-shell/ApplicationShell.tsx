/** @spec dashboard-home REQ-001..REQ-017; dashboard-logout REQ-001..REQ-004, REQ-010; sites-empty-state REQ-002..REQ-004, REQ-008..REQ-012; sites-populated-state REQ-005..REQ-008, REQ-018, REQ-020..REQ-022; site-details-activity-shell REQ-005, REQ-007, REQ-014..REQ-017 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DashboardResponse } from '@hansel/contracts';
import { Button } from '../design-system/index.js';

const destinations = [
  { label: 'Dashboard', icon: 'home', href: '/dashboard' },
  { label: 'Sites', icon: 'domain_add', href: '/sites' },
] as const;

const libraries = [
  { label: 'Styleguide', icon: 'text_fields' },
  { label: 'Documents', icon: 'folder' },
] as const;

export function AppSymbol({
  children,
  className = '',
  weight = 200,
}: {
  children: string;
  className?: string;
  weight?: 100 | 200;
}) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-${String(weight)} inline-flex size-6 shrink-0 items-center justify-center text-[24px] ${className}`}
    >
      {children}
    </span>
  );
}

export function NotificationSymbol() {
  return (
    <span className="relative inline-flex" aria-hidden="true">
      <AppSymbol weight={100}>notifications_none</AppSymbol>
      <span className="absolute right-[2px] top-0 size-[6px] rounded-full bg-[#f59e0b]" />
    </span>
  );
}

export interface ApplicationShellProps {
  activePage: 'Dashboard' | 'Sites';
  children: ReactNode;
  headerActions: ReactNode;
  headerLeading?: ReactNode;
  loadDashboard: () => Promise<DashboardResponse>;
  loadErrorMessage: string;
  logout: () => Promise<void>;
  navigate?: ((destination: string) => void) | undefined;
  pageHeading?: string | undefined;
  preloadedViewer?: DashboardResponse['viewer'] | undefined;
  currentSiteId?: string | undefined;
  siteNavigation?: readonly { id: string; name: string }[] | undefined;
  workspaceName?: string | undefined;
}

export function ApplicationShell({
  activePage,
  children,
  headerActions,
  headerLeading,
  loadDashboard,
  loadErrorMessage,
  logout,
  navigate,
  pageHeading,
  preloadedViewer,
  currentSiteId,
  siteNavigation,
  workspaceName,
}: ApplicationShellProps) {
  const [viewer, setViewer] = useState<DashboardResponse['viewer'] | null>(
    null,
  );
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [sitesExpanded, setSitesExpanded] = useState(true);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const logoutButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (preloadedViewer) return;
    let active = true;
    setLoadError(false);
    setViewer(null);
    void loadDashboard()
      .then((response) => {
        if (active) setViewer(response.viewer);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt, loadDashboard, preloadedViewer]);

  const displayedViewer = preloadedViewer ?? viewer;

  useEffect(() => {
    if (!menuOpen) return;
    logoutButtonRef.current?.focus();
    const closeOutside = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node))
        setMenuOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      accountButtonRef.current?.focus();
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [menuOpen]);

  return (
    <main className="flex min-h-screen bg-surface text-content max-md:flex-col max-md:overflow-x-clip">
      <h1 className="sr-only">{pageHeading ?? activePage}</h1>
      <aside
        className={`flex shrink-0 flex-col border-r border-[#e5e5e5] bg-surface py-7 max-md:w-full max-md:border-b max-md:border-r-0 max-md:px-5 max-md:py-5 ${workspaceName ? 'w-[300px] px-6' : 'w-[284px] px-8'}`}
      >
        {workspaceName ? (
          <div className="flex h-8 min-w-0 items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded bg-[#f5f6f8] text-[12px] font-semibold text-[#607080]">
              {workspaceName.charAt(0).toLocaleUpperCase()}
            </span>
            <span
              className="truncate text-[16px] font-medium"
              title={workspaceName}
            >
              {workspaceName}
            </span>
          </div>
        ) : (
          <img
            className="h-[27px] w-auto self-start"
            src="/assets/hansel-logo-beta.svg"
            alt="Hansel Beta"
          />
        )}
        <nav
          className={`flex flex-1 flex-col max-md:mt-7 ${workspaceName ? 'mt-[31px]' : 'mt-[66px] max-md:grid max-md:grid-cols-2 max-md:gap-2'}`}
          aria-label="Application"
        >
          <div className="grid gap-3">
            {destinations.map((item) => {
              const current = item.label === activePage;
              const hasSiteNavigation =
                item.label === 'Sites' && Boolean(siteNavigation?.length);
              return (
                <div className="grid" key={item.label}>
                  <div
                    className={`flex min-h-12 items-center rounded ${current ? 'bg-[#f3f3f3] font-semibold' : 'text-[#4d4d4d] hover:bg-[#f7f7f7]'}`}
                  >
                    <a
                      href={item.href}
                      aria-current={
                        current && !currentSiteId ? 'page' : undefined
                      }
                      className={`flex min-w-0 flex-1 items-center gap-3 rounded py-3 text-[16px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${workspaceName ? 'px-3' : 'px-4'}`}
                      onClick={(event) => {
                        if (!navigate) return;
                        event.preventDefault();
                        navigate(item.href);
                      }}
                    >
                      <AppSymbol>{item.icon}</AppSymbol>
                      {item.label}
                    </a>
                    {hasSiteNavigation ? (
                      <button
                        type="button"
                        aria-expanded={sitesExpanded}
                        aria-label={
                          sitesExpanded ? 'Collapse sites' : 'Expand sites'
                        }
                        className="mr-2 grid size-8 place-items-center rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        onClick={() => {
                          setSitesExpanded((expanded) => !expanded);
                        }}
                      >
                        <AppSymbol className="!size-4 text-[18px]">
                          {sitesExpanded
                            ? 'keyboard_arrow_up'
                            : 'keyboard_arrow_down'}
                        </AppSymbol>
                      </button>
                    ) : null}
                  </div>
                  {hasSiteNavigation && sitesExpanded ? (
                    <ul className="mt-1 grid gap-1" aria-label="Sites">
                      {siteNavigation?.map((site) => (
                        <li key={site.id}>
                          <a
                            aria-current={
                              site.id === currentSiteId ? 'page' : undefined
                            }
                            href={`/sites/${encodeURIComponent(site.id)}/activity`}
                            className={`flex min-h-10 items-center gap-2 rounded px-3 text-[13px] hover:bg-[#f7f7f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${site.id === currentSiteId ? 'bg-[#f7f7f7] font-semibold text-content' : 'font-normal text-[#4d4d4d]'}`}
                            onClick={(event) => {
                              if (!navigate) return;
                              event.preventDefault();
                              navigate(
                                `/sites/${encodeURIComponent(site.id)}/activity`,
                              );
                            }}
                          >
                            <span className="grid size-5 shrink-0 place-items-center rounded-sm bg-site-symbol text-on-action">
                              <AppSymbol
                                className="!size-4 text-[15px]"
                                weight={100}
                              >
                                domain
                              </AppSymbol>
                            </span>
                            <span className="truncate" title={site.name}>
                              {site.name}
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-11 grid gap-3 max-md:mt-0">
            <p className="px-4 text-[13px] text-[#737373]">Libraries</p>
            {libraries.map((item) => (
              <span
                key={item.label}
                aria-disabled="true"
                className="flex min-h-12 items-center gap-3 rounded px-4 text-[16px] text-[#4d4d4d]"
              >
                <AppSymbol>{item.icon}</AppSymbol>
                {item.label}
              </span>
            ))}
          </div>
        </nav>
        <div ref={accountMenuRef} className="relative mt-8 max-md:mt-6">
          {menuOpen ? (
            <div
              id="application-account-menu"
              role="menu"
              aria-label="Account"
              className="absolute bottom-full left-0 z-10 mb-2 w-full rounded-lg border border-[#dddddd] bg-surface p-2 shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
            >
              <button
                ref={logoutButtonRef}
                type="button"
                role="menuitem"
                disabled={logoutPending}
                className="flex min-h-11 w-full items-center gap-3 rounded px-3 text-left text-[15px] hover:bg-[#f3f3f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait disabled:opacity-60"
                onClick={() => {
                  setLogoutPending(true);
                  setLogoutError(false);
                  void logout()
                    .then(() => {
                      setMenuOpen(false);
                    })
                    .catch(() => {
                      setMenuOpen(true);
                      setLogoutError(true);
                    })
                    .finally(() => {
                      setLogoutPending(false);
                    });
                }}
              >
                <AppSymbol>logout</AppSymbol>
                {logoutPending ? 'Logging out…' : 'Log out'}
              </button>
              {logoutError ? (
                <p role="alert" className="px-3 pb-2 pt-1 text-sm text-danger">
                  We couldn't log you out. Please try again.
                </p>
              ) : null}
            </div>
          ) : null}
          {displayedViewer ? (
            <button
              ref={accountButtonRef}
              type="button"
              aria-label={`${displayedViewer.displayName}, ${displayedViewer.roleLabel}`}
              aria-haspopup="menu"
              aria-controls="application-account-menu"
              aria-expanded={menuOpen}
              className="flex min-h-14 w-full items-center gap-4 rounded text-left hover:bg-[#f7f7f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              onClick={() => {
                setLogoutError(false);
                setMenuOpen((open) => !open);
              }}
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#e9e9e9] text-sm text-[#444]">
                {displayedViewer.initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[16px]">
                  {displayedViewer.displayName}
                </span>
                <span className="mt-1 block truncate text-[14px] text-[#737373]">
                  {displayedViewer.roleLabel}
                </span>
              </span>
            </button>
          ) : loadError ? null : (
            <p role="status" className="min-h-14 text-sm text-[#737373]">
              Loading account…
            </p>
          )}
        </div>
      </aside>
      <section className="min-w-0 flex-1">
        <header
          className={`flex items-center gap-5 border-b border-[#e5e5e5] px-8 ${headerLeading ? 'min-h-[68px] max-w-full justify-between max-md:min-h-14 max-md:flex-wrap max-md:px-5 max-md:py-3' : 'h-[68px] justify-end max-md:h-14 max-md:px-5'}`}
        >
          {headerLeading ? (
            <div className="min-w-0 flex-1">{headerLeading}</div>
          ) : null}
          <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-5 max-md:gap-2">
            {headerActions}
          </div>
        </header>
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
      </section>
    </main>
  );
}
