/** @spec dashboard-home REQ-001..REQ-017; dashboard-logout REQ-001..REQ-004, REQ-010; sites-empty-state REQ-002..REQ-004, REQ-008..REQ-012; sites-populated-state REQ-005..REQ-008, REQ-018, REQ-020..REQ-022; site-details-activity-shell REQ-005, REQ-007, REQ-014..REQ-017 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { DashboardResponse } from '@hansel/contracts';
import { Button } from '../design-system/index.js';
import { AccountSettingsModal } from './AccountSettingsModal.js';

const destinations = [
  {
    label: 'Home',
    activePage: 'Dashboard',
    icon: 'home',
    href: '/dashboard',
    showsSites: false,
  },
  {
    label: 'My Sites',
    activePage: 'Sites',
    icon: 'layers',
    href: '/sites',
    showsSites: true,
  },
  {
    label: 'Shared Sites',
    activePage: null,
    icon: 'layers',
    href: '/sites',
    showsSites: false,
  },
] as const;

const sidebarIconPaths = {
  home: '/assets/sidebar-icons/home.svg',
  mySites: '/assets/sidebar-icons/my-sites.svg',
  sharedSites: '/assets/sidebar-icons/shared-sites.svg',
  library: '/assets/sidebar-icons/library.svg',
  newSite: '/assets/sidebar-icons/new-site.svg',
  site: '/assets/sidebar-icons/site.svg',
} as const;

function SidebarIcon({
  name,
  className = '',
}: {
  name: keyof typeof sidebarIconPaths;
  className?: string;
}) {
  return (
    <img
      aria-hidden="true"
      className={`size-4 shrink-0 ${className}`}
      src={sidebarIconPaths[name]}
      alt=""
    />
  );
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sitesExpanded, setSitesExpanded] = useState(true);
  const [siteTooltip, setSiteTooltip] = useState<
    { label: string; left: number; top: number } | undefined
  >();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const logoutButtonRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  const showSiteTooltip = (
    event:
      React.MouseEvent<HTMLAnchorElement> | React.FocusEvent<HTMLAnchorElement>,
    label: string,
  ) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setSiteTooltip({
      label,
      left: bounds.left + bounds.width / 2,
      top: bounds.top - 4,
    });
  };

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
  const visibleSiteNavigation = siteNavigation?.slice(0, 5);
  const canCreateSiteFromSidebar = Boolean(onCreateSite ?? navigate);
  const canManageOrganization = ['Owner', 'Administrator', 'Editor'].includes(
    displayedViewer?.roleLabel ?? '',
  );

  useEffect(() => {
    if (!menuOpen) return;
    (organization && canManageOrganization
      ? settingsButtonRef
      : logoutButtonRef
    ).current?.focus();
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
  }, [canManageOrganization, menuOpen, organization]);

  return (
    <main className="flex min-h-screen bg-surface text-content md:h-dvh md:overflow-hidden max-md:flex-col max-md:overflow-x-clip">
      <h1 className="sr-only">{pageHeading ?? activePage}</h1>
      <aside className="flex shrink-0 flex-col border-r border-[#e5e5e5] bg-sidebar-background px-[18px] py-6 md:w-[252px] md:overflow-x-clip md:overflow-y-auto md:[&>*]:shrink-0 max-md:w-full max-md:border-b max-md:border-r-0 max-md:px-5 max-md:py-5">
        {organizationName ? (
          <div
            ref={organization ? accountMenuRef : undefined}
            className="relative flex h-9 min-w-0 items-center gap-2"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-[4px] bg-sidebar-brand text-[12px] font-semibold text-white">
              {organizationName.charAt(0).toLocaleUpperCase()}
            </span>
            <span
              className="truncate text-[13px] font-semibold leading-5 text-content"
              title={organizationName}
            >
              {organizationName}
            </span>
            {organization ? (
              <button
                ref={accountButtonRef}
                type="button"
                aria-label="Open Organization menu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls="organization-menu"
                className="ml-auto grid size-7 place-items-center rounded-[4px] text-content-muted focus-visible:outline-2 focus-visible:outline-focus"
                onClick={() => {
                  setMenuOpen((open) => !open);
                }}
              >
                <AppSymbol>more_vert</AppSymbol>
              </button>
            ) : null}
            {organization && menuOpen && displayedViewer ? (
              <div
                id="organization-menu"
                role="menu"
                aria-label="Organization"
                className="absolute left-0 top-9 z-20 w-full overflow-hidden rounded-[8px] border border-[#dedede] bg-surface shadow-[0_12px_28px_rgb(0_0_0/0.10)]"
              >
                <div
                  role="presentation"
                  className="mx-4 flex h-[52px] min-w-0 items-center gap-[7px] border-b border-[#dedede] text-[14px]"
                >
                  <span className="grid size-5 shrink-0 place-items-center rounded-[3px] bg-[#f0f3f7] text-[#687991]">
                    <svg
                      aria-hidden="true"
                      className="size-[14px]"
                      fill="none"
                      viewBox="0 0 14 14"
                    >
                      <path
                        d="m1.75 4 2.7 2.2L7 2.5l2.55 3.7L12.25 4l-1 7H2.75l-1-7Z"
                        stroke="currentColor"
                        strokeLinejoin="round"
                        strokeWidth="1.2"
                      />
                    </svg>
                  </span>
                  <span className="truncate">
                    {organization.planDisplayName}
                  </span>
                </div>
                {canManageOrganization ? (
                  <div
                    role="group"
                    aria-label="Organization management"
                    className="mx-4 grid border-b border-[#dedede] py-[10px]"
                  >
                    <button
                      ref={settingsButtonRef}
                      role="menuitem"
                      type="button"
                      className="flex h-[34px] w-full items-center gap-[7px] rounded text-left text-[16px] hover:bg-[#f3f3f3] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
                      onClick={() => {
                        setMenuOpen(false);
                        setSettingsOpen(true);
                      }}
                    >
                      <AppSymbol className="text-[22px]" weight={100}>
                        tune
                      </AppSymbol>
                      Settings
                    </button>
                    <button
                      role="menuitem"
                      aria-disabled="true"
                      disabled
                      type="button"
                      className="flex h-[34px] w-full items-center gap-[7px] text-left text-[16px] disabled:cursor-default disabled:opacity-100"
                    >
                      <AppSymbol className="text-[22px]" weight={100}>
                        group_add
                      </AppSymbol>
                      Invite members
                    </button>
                  </div>
                ) : null}
                <div
                  role="group"
                  aria-label="Account"
                  className="px-4 py-[11px]"
                >
                  <div
                    role="presentation"
                    className="flex h-[34px] min-w-0 items-center gap-[7px] text-[14px]"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#64748b] text-[10px] text-white">
                      {displayedViewer.initials}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {displayedViewer.displayName}
                    </span>
                    <span className="max-w-[70px] shrink-0 truncate rounded-[3px] bg-[#e4e9ef] px-2 py-[2px] text-[11px] leading-4">
                      {displayedViewer.roleLabel}
                    </span>
                  </div>
                  <button
                    ref={logoutButtonRef}
                    role="menuitem"
                    disabled={logoutPending}
                    type="button"
                    className="flex h-[34px] w-full items-center gap-[7px] rounded text-left text-[16px] hover:bg-[#f3f3f3] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus disabled:opacity-60"
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
                    <AppSymbol className="text-[22px]" weight={100}>
                      logout
                    </AppSymbol>
                    {logoutPending ? 'Logging out…' : 'Log out'}
                  </button>
                  {logoutError ? (
                    <p role="alert" className="py-1 text-sm text-danger">
                      We couldn't log you out. Please try again.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <img
            className="h-[27px] w-auto self-start"
            src="/assets/hansel-logo-beta.svg"
            alt="Hansel Beta"
          />
        )}
        <nav
          className="mt-8 flex flex-1 flex-col max-md:mt-7"
          aria-label="Application"
        >
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1">
            {destinations.map((item) => {
              const current = item.activePage === activePage;
              const hasSiteNavigation =
                item.showsSites && Boolean(siteNavigation?.length);
              return (
                <div
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)]"
                  key={item.label}
                >
                  <div
                    className={`flex min-h-7 items-center rounded-[4px] ${current ? 'bg-sidebar-item-active font-medium' : 'text-content hover:bg-sidebar-item-hover'}`}
                  >
                    <a
                      href={item.href}
                      aria-current={
                        current && !currentSiteId ? 'page' : undefined
                      }
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-[4px] px-2 py-[5px] text-[12px] leading-[18px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                      onClick={(event) => {
                        event.preventDefault();
                        navigate?.(item.href);
                      }}
                    >
                      <SidebarIcon
                        name={
                          item.label === 'Home'
                            ? 'home'
                            : item.label === 'My Sites'
                              ? 'mySites'
                              : 'sharedSites'
                        }
                      />
                      {item.label}
                      {item.showsSites && siteNavigation?.length ? (
                        <span className="ml-auto text-[11px] text-sidebar-count">
                          {siteNavigation.length}
                        </span>
                      ) : null}
                    </a>
                    {hasSiteNavigation ? (
                      <button
                        type="button"
                        aria-expanded={sitesExpanded}
                        aria-label={
                          sitesExpanded ? 'Collapse sites' : 'Expand sites'
                        }
                        className="mr-1 grid size-6 place-items-center rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        onClick={() => {
                          setSitesExpanded((expanded) => !expanded);
                        }}
                      >
                        <AppSymbol className="!size-4 text-[14px] text-content-muted">
                          {sitesExpanded
                            ? 'keyboard_arrow_up'
                            : 'keyboard_arrow_down'}
                        </AppSymbol>
                      </button>
                    ) : null}
                  </div>
                  {hasSiteNavigation && sitesExpanded ? (
                    <ul
                      className="mt-1 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-0.5"
                      aria-label="My Sites"
                    >
                      {visibleSiteNavigation?.map((site) => (
                        <li className="group relative min-w-0" key={site.id}>
                          <a
                            aria-current={
                              site.id === currentSiteId ? 'page' : undefined
                            }
                            href={`/sites/${encodeURIComponent(site.id)}/activity`}
                            className={`flex min-h-7 items-center gap-2 rounded-[4px] pl-[30px] pr-2 text-[12px] leading-[18px] hover:bg-sidebar-item-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${site.id === currentSiteId ? 'font-medium text-content' : 'font-normal text-content'}`}
                            onMouseEnter={(event) => {
                              showSiteTooltip(event, site.name);
                            }}
                            onMouseLeave={() => {
                              setSiteTooltip(undefined);
                            }}
                            onFocus={(event) => {
                              showSiteTooltip(event, site.name);
                            }}
                            onBlur={() => {
                              setSiteTooltip(undefined);
                            }}
                            onClick={(event) => {
                              event.preventDefault();
                              navigate?.(
                                `/sites/${encodeURIComponent(site.id)}/activity`,
                              );
                            }}
                          >
                            <SidebarIcon name="site" />
                            <span className="min-w-0 flex-1 truncate">
                              {site.name}
                            </span>
                          </a>
                        </li>
                      ))}
                      {canCreateSiteFromSidebar ? (
                        <li className="min-w-0">
                          <button
                            type="button"
                            disabled={onCreateSite ? createSiteDisabled : false}
                            className="flex min-h-7 w-full items-center gap-2 rounded-[4px] pl-[30px] pr-2 text-left text-[12px] leading-[18px] text-content-brand hover:bg-sidebar-item-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                            onClick={() => {
                              if (onCreateSite) {
                                onCreateSite();
                              } else {
                                navigate?.('/sites');
                              }
                            }}
                          >
                            <SidebarIcon name="newSite" />
                            New site
                          </button>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-5 grid gap-1 max-md:mt-0">
            <a
              href="/library/files"
              aria-current={activePage === 'Files' ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigate?.('/library/files');
              }}
              className={`flex min-h-7 items-center gap-2 rounded-[4px] px-2 text-[12px] leading-[18px] text-content hover:bg-sidebar-item-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${activePage === 'Files' ? 'bg-sidebar-item-active font-medium' : ''}`}
            >
              <SidebarIcon name="library" />
              Library
            </a>
          </div>
        </nav>
        {!organization ? (
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
                  <p
                    role="alert"
                    className="px-3 pb-2 pt-1 text-sm text-danger"
                  >
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
        ) : null}
      </aside>
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
            queueMicrotask(() => accountButtonRef.current?.focus());
          }}
        />
      ) : null}
      {siteTooltip
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[4px] bg-zinc-800 px-2 py-2 text-[11px] leading-normal text-white shadow-sm"
              style={{ left: siteTooltip.left, top: siteTooltip.top }}
            >
              {siteTooltip.label}
            </span>,
            document.body,
          )
        : null}
    </main>
  );
}
