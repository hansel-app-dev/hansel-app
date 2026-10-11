import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DashboardResponse } from '@hansel/contracts';
import { AppSymbol, SidebarIcon } from './SidebarPrimitives.js';
import {
  InviteMembersModal,
  type WorkspaceInvite,
} from './InviteMembersModal.js';

const destinations = [
  {
    label: 'Home',
    activePage: 'Dashboard',
    href: '/dashboard',
    showsSites: false,
  },
  { label: 'My Sites', activePage: 'Sites', href: '/sites', showsSites: true },
  {
    label: 'Shared Sites',
    activePage: 'SharedSites',
    href: '/shared-sites',
    showsSites: false,
  },
] as const;

export interface SidebarProps {
  activePage: 'Dashboard' | 'Sites' | 'Files' | 'SharedSites';
  currentSiteId?: string | undefined;
  siteNavigation?: readonly { id: string; name: string }[] | undefined;
  siteCount?: number | undefined;
  organizationName?: string | undefined;
  organization?: DashboardResponse['organization'] | undefined;
  displayedViewer?: DashboardResponse['viewer'] | undefined;
  canManageOrganization: boolean;
  canInviteMembers: boolean;
  canCreateSiteFromSidebar: boolean;
  createSiteDisabled: boolean;
  loadError: boolean;
  navigate?: ((destination: string) => void) | undefined;
  onCreateSite?: (() => void) | undefined;
  onOpenSettings: () => void;
  onInviteMembers:
    ((invites: readonly WorkspaceInvite[]) => void | Promise<void>) | undefined;
  onUpgrade: (() => void) | undefined;
  settingsOpen: boolean;
  logout: () => Promise<void>;
}

export function Sidebar({
  activePage,
  currentSiteId,
  siteNavigation,
  siteCount,
  organizationName,
  organization,
  displayedViewer,
  canManageOrganization,
  canInviteMembers,
  canCreateSiteFromSidebar,
  createSiteDisabled,
  loadError,
  navigate,
  onCreateSite,
  onOpenSettings,
  onInviteMembers,
  onUpgrade,
  settingsOpen,
  logout,
}: SidebarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [sitesExpanded, setSitesExpanded] = useState(true);
  const [siteTooltip, setSiteTooltip] = useState<{
    label: string;
    left: number;
    top: number;
  }>();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const organizationMenuRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const logoutButtonRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [organizationMenuPosition, setOrganizationMenuPosition] = useState<{
    left: number;
    top: number;
  }>();
  const wasSettingsOpen = useRef(false);
  const visibleSiteNavigation = siteNavigation?.slice(0, 5);

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
    if (!menuOpen) return;
    const closeOutside = (event: MouseEvent) => {
      if (
        !accountMenuRef.current?.contains(event.target as Node) &&
        !organizationMenuRef.current?.contains(event.target as Node)
      )
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

  useEffect(() => {
    if (!menuOpen) return;
    (organization && canManageOrganization
      ? settingsButtonRef
      : logoutButtonRef
    ).current?.focus();
  }, [canManageOrganization, menuOpen, organization, organizationMenuPosition]);

  useEffect(() => {
    if (wasSettingsOpen.current && !settingsOpen)
      accountButtonRef.current?.focus();
    wasSettingsOpen.current = settingsOpen;
  }, [settingsOpen]);

  useLayoutEffect(() => {
    if (!menuOpen || !organization) return;
    const updatePosition = () => {
      const bounds = accountMenuRef.current?.getBoundingClientRect();
      if (bounds)
        setOrganizationMenuPosition({ left: bounds.left, top: bounds.bottom });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [menuOpen, organization]);

  return (
    <>
      <aside className="flex shrink-0 flex-col border-r border-[#e5e5e5] bg-sidebar-background px-[18px] py-6 md:w-[252px] md:overflow-x-clip md:overflow-y-auto md:[&>*]:shrink-0 max-md:w-full max-md:border-b max-md:border-r-0 max-md:px-5 max-md:py-5">
        {organizationName ? (
          <div
            ref={organization ? accountMenuRef : undefined}
            className="group relative flex h-9 min-w-0 items-center gap-2 rounded-[8px] pl-[2px] pr-1 py-[2px] hover:bg-[#e7e5e4]"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-[6px] bg-[#65a30d] text-[13px] font-bold leading-[19.6px] text-white">
              {organizationName.charAt(0).toLocaleUpperCase()}
            </span>
            <span
              className="truncate text-[13px] font-medium leading-[19.6px] text-[#292524]"
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
                className="ml-auto grid size-6 shrink-0 place-items-center rounded-[4px] text-content-muted opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-focus"
                onClick={() => {
                  setMenuOpen((open) => !open);
                }}
              >
                <img
                  src="/assets/organization-menu/more-vertical.svg"
                  alt=""
                  aria-hidden="true"
                />
              </button>
            ) : null}
            {organization &&
            menuOpen &&
            displayedViewer &&
            organizationMenuPosition
              ? createPortal(
                  <div
                    ref={organizationMenuRef}
                    id="organization-menu"
                    role="menu"
                    aria-label="Organization"
                    style={{
                      left: organizationMenuPosition.left,
                      top: organizationMenuPosition.top,
                    }}
                    className="fixed z-50 flex w-[300px] flex-col gap-4 rounded-[8px] border border-[#e4e4e7] bg-white p-4 text-[#27272a] shadow-[0_16px_32px_-4px_rgb(12_12_13/0.10),0_4px_4px_-4px_rgb(12_12_13/0.05)]"
                  >
                    <div
                      role="presentation"
                      className="flex h-5 items-center gap-1.5 text-[11px] leading-[19.6px]"
                    >
                      <span className="grid size-5 shrink-0 place-items-center rounded-[4px] bg-[#f1f5f9]">
                        <img
                          src="/assets/organization-menu/queen.svg"
                          alt=""
                          aria-hidden="true"
                          className="size-[13px]"
                        />
                      </span>
                      <span className="truncate">
                        {organization.planDisplayName === 'Pro Plan'
                          ? 'Pro'
                          : organization.planDisplayName}
                      </span>
                      {organization.planDisplayName === 'Free Plan' ? (
                        <button
                          className="ml-auto rounded-[4px] bg-[#334155] px-2 py-1 text-[11px] text-white hover:bg-[#334155]"
                          onClick={() => {
                            setMenuOpen(false);
                            onUpgrade?.();
                          }}
                          role="menuitem"
                          type="button"
                        >
                          Upgrade
                        </button>
                      ) : null}
                    </div>
                    <div className="h-0 w-full" aria-hidden="true">
                      <img
                        src="/assets/organization-menu/divider.svg"
                        alt=""
                        className="relative -top-px block h-px w-full"
                      />
                    </div>
                    {canManageOrganization || canInviteMembers ? (
                      <div
                        role="group"
                        aria-label="Organization management"
                        className="grid gap-0.5"
                      >
                        {canManageOrganization ? (
                          <button
                            ref={settingsButtonRef}
                            role="menuitem"
                            type="button"
                            className="flex h-8 w-full items-center gap-1.5 rounded-[4px] p-1 text-left text-[13px] leading-[19.6px] hover:bg-[#e7e5e4] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
                            onClick={() => {
                              setMenuOpen(false);
                              onOpenSettings();
                            }}
                          >
                            <img
                              src="/assets/organization-menu/settings.svg"
                              alt=""
                              aria-hidden="true"
                              className="size-4"
                            />
                            Settings
                          </button>
                        ) : null}
                        {canInviteMembers ? (
                          <button
                            role="menuitem"
                            type="button"
                            className="flex h-8 w-full items-center gap-1.5 rounded-[4px] p-1 text-left text-[13px] leading-[19.6px] hover:bg-[#e7e5e4] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
                            onClick={() => {
                              setMenuOpen(false);
                              setInviteOpen(true);
                            }}
                          >
                            <img
                              src="/assets/organization-menu/invite.svg"
                              alt=""
                              aria-hidden="true"
                              className="size-4"
                            />
                            Invite members
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="h-0 w-full" aria-hidden="true">
                      <img
                        src="/assets/organization-menu/divider.svg"
                        alt=""
                        className="relative -top-px block h-px w-full"
                      />
                    </div>
                    <div
                      role="group"
                      aria-label="Account"
                      className="grid gap-0.5"
                    >
                      <div
                        role="presentation"
                        className="flex h-8 min-w-0 items-center gap-1.5 rounded-[4px] p-1 text-[13px] leading-[19.6px]"
                      >
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#64748b] font-['Figtree_Variable'] text-[10px] font-bold leading-[0px] tracking-[0.5px] text-white">
                          {displayedViewer.initials}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {displayedViewer.displayName}
                        </span>
                        <span className="shrink-0 rounded-[4px] border border-[#d6d3d1] bg-[#e7e5e4] px-2 py-[3px] text-[11px] leading-[14px] text-[#78716c]">
                          {displayedViewer.roleLabel}
                        </span>
                      </div>
                      <button
                        ref={logoutButtonRef}
                        role="menuitem"
                        disabled={logoutPending}
                        type="button"
                        className="flex h-8 w-full items-center gap-1.5 rounded-[4px] p-1 text-left text-[13px] leading-[19.6px] hover:bg-[#e7e5e4] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus disabled:opacity-60"
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
                        <img
                          src="/assets/organization-menu/logout.svg"
                          alt=""
                          aria-hidden="true"
                          className="size-4"
                        />
                        {logoutPending ? 'Logging out…' : 'Log out'}
                      </button>
                      {logoutError ? (
                        <p
                          role="alert"
                          className="px-1 py-1 text-sm text-danger"
                        >
                          We couldn't log you out. Please try again.
                        </p>
                      ) : null}
                    </div>
                  </div>,
                  document.body,
                )
              : null}
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
              const showSitesDisclosure =
                item.showsSites &&
                (current || hasSiteNavigation || (siteCount ?? 0) > 0);
              return (
                <div
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)]"
                  key={item.label}
                >
                  <div
                    className={`group flex min-h-7 items-center rounded-[4px] ${current ? 'bg-sidebar-item-active font-medium' : 'text-content hover:bg-sidebar-item-hover'}`}
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
                      {item.showsSites && siteCount !== undefined ? (
                        <span
                          className={`ml-auto text-[11px] text-sidebar-count transition-transform duration-150 ease-out motion-reduce:transition-none ${current ? '' : 'group-hover:-translate-x-1'}`}
                        >
                          {siteCount}
                        </span>
                      ) : null}
                    </a>
                    {showSitesDisclosure ? (
                      <button
                        type="button"
                        disabled={!hasSiteNavigation}
                        aria-expanded={
                          current || (hasSiteNavigation && sitesExpanded)
                        }
                        aria-label={
                          current || (hasSiteNavigation && sitesExpanded)
                            ? 'Collapse sites'
                            : 'Expand sites'
                        }
                        className={`mr-1 ${current ? 'grid' : 'hidden group-hover:grid group-focus-within:grid'} size-6 place-items-center rounded-[4px] focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-default`}
                        onClick={() => {
                          setSitesExpanded((expanded) => !expanded);
                        }}
                      >
                        <AppSymbol className="!size-4 text-[14px] text-content-muted">
                          {current || (hasSiteNavigation && sitesExpanded)
                            ? 'keyboard_arrow_up'
                            : 'keyboard_arrow_down'}
                        </AppSymbol>
                      </button>
                    ) : null}
                  </div>
                  {(hasSiteNavigation ||
                    (item.showsSites && canCreateSiteFromSidebar)) &&
                  sitesExpanded ? (
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
          <div className="mt-0.5 grid gap-1 max-md:mt-0">
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
      {inviteOpen ? (
        <InviteMembersModal
          onClose={() => setInviteOpen(false)}
          {...(onInviteMembers ? { onSubmit: onInviteMembers } : {})}
        />
      ) : null}
    </>
  );
}
