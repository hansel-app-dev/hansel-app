const sidebarIconPaths = {
  home: '/assets/sidebar-icons/home.svg',
  mySites: '/assets/sidebar-icons/my-sites.svg',
  sharedSites: '/assets/sidebar-icons/shared-sites.svg',
  library: '/assets/sidebar-icons/library.svg',
  newSite: '/assets/sidebar-icons/new-site.svg',
  site: '/assets/sidebar-icons/site.svg',
} as const;

export function SidebarIcon({
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
