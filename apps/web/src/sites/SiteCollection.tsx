/** @spec sites-populated-state REQ-001, REQ-004..REQ-015, REQ-020..REQ-025 @spec site-details-activity-shell REQ-008, REQ-019 @figma 2025:11221, 2043:3580, 2030:3333 */
import { useState } from 'react';
import type { SiteSummary } from '@hansel/contracts';
import { AppSymbol } from '../application-shell/ApplicationShell.js';
import { SiteCoverImage, type CoverImageLoader } from './SiteCoverImage.js';

export type SiteView = 'grid' | 'list';

function avatarColorClass(index: number) {
  return index % 3 === 2 ? 'bg-[#9038d0]' : 'bg-[#2873ca]';
}

function siteDestination(siteId: string) {
  return `/sites/${encodeURIComponent(siteId)}/activity`;
}

export function relativeTime(instant: string, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - new Date(instant).getTime());
  const units = [
    ['year', 365 * 24 * 60 * 60 * 1_000],
    ['month', 30 * 24 * 60 * 60 * 1_000],
    ['day', 24 * 60 * 60 * 1_000],
    ['hour', 60 * 60 * 1_000],
    ['minute', 60 * 1_000],
  ] as const;
  for (const [label, duration] of units) {
    const count = Math.floor(elapsed / duration);
    if (count >= 1)
      return `${String(count)} ${label}${count === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

export function SiteSymbol() {
  return (
    <span
      className="grid size-5 shrink-0 place-items-center rounded-sm bg-site-symbol text-on-action"
      aria-hidden="true"
    >
      <AppSymbol className="!size-4 text-[15px]" weight={100}>
        domain
      </AppSymbol>
    </span>
  );
}

function SiteLink({
  children,
  className,
  navigate,
  site,
}: {
  children: React.ReactNode;
  className: string;
  navigate?: ((destination: string) => void) | undefined;
  site: SiteSummary;
}) {
  const destination = siteDestination(site.id);
  return (
    <a
      aria-label={site.name}
      className={className}
      href={destination}
      onClick={(event) => {
        if (!navigate) return;
        event.preventDefault();
        navigate(destination);
      }}
    >
      {children}
    </a>
  );
}

export function SiteMemberPreview({ site }: { site: SiteSummary }) {
  const remaining = Math.max(0, site.memberCount - site.memberPreview.length);
  const names = site.memberPreview.map(({ displayName }) => displayName);
  const accessibleLabel = [
    names.length ? `Members: ${names.join(', ')}` : 'No direct members',
    remaining ? `${String(remaining)} more` : null,
  ]
    .filter(Boolean)
    .join('; ');
  return (
    <span
      className="flex h-[22px] items-center"
      aria-label={accessibleLabel}
      role="group"
    >
      {site.memberPreview.map((member, index) => (
        <span
          aria-hidden="true"
          className={`-ml-[6px] grid size-[22px] place-items-center rounded-full border border-white text-[9px] font-semibold text-white first:ml-0 ${avatarColorClass(index)}`}
          key={`${member.displayName}-${String(index)}`}
        >
          {member.initials}
        </span>
      ))}
      {remaining ? (
        <span
          aria-hidden="true"
          className="-ml-[6px] grid size-[22px] place-items-center rounded-full border border-white bg-avatar-more text-[9px] font-semibold text-avatar-more-foreground"
        >
          +{String(remaining)}
        </span>
      ) : null}
    </span>
  );
}

export function SiteViewControl({
  onChange,
  view,
}: {
  onChange: (view: SiteView) => void;
  view: SiteView;
}) {
  return (
    <div className="flex items-center gap-2" aria-label="Site view">
      {(
        [
          ['grid', 'Grid view', 'grid_view'],
          ['list', 'List view', 'view_list'],
        ] as const
      ).map(([value, label, icon]) => (
        <button
          aria-label={label}
          aria-pressed={view === value}
          className={`grid size-7 place-items-center rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${view === value ? 'text-site-view-selected' : 'text-site-view-idle hover:text-site-view-hover'}`}
          key={value}
          onClick={() => {
            onChange(value);
          }}
          type="button"
        >
          <AppSymbol weight={100}>{icon}</AppSymbol>
        </button>
      ))}
    </div>
  );
}

export function SiteGrid({
  loadCoverImage,
  navigate,
  now,
  sites,
}: {
  loadCoverImage?: CoverImageLoader | undefined;
  navigate?: ((destination: string) => void) | undefined;
  now: Date;
  sites: readonly SiteSummary[];
}) {
  return (
    <ul
      aria-label="Sites grid"
      className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,275px),275px))] gap-4"
    >
      {sites.map((site) => {
        const isNew = site.createdAt === site.updatedAt;
        return (
          <li className="group relative min-w-0" key={site.id}>
            <SiteLink
              className="block overflow-hidden rounded-[4px] border border-[#e2e2e7] bg-white transition-shadow duration-150 hover:shadow-[0_2px_3px_rgb(0_0_0/18%)] focus-visible:shadow-[0_2px_3px_rgb(0_0_0/18%)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none"
              navigate={navigate}
              site={site}
            >
              <SiteCoverImage
                siteId={site.id}
                hasCoverImage={site.hasCoverImage ?? false}
                loadCoverImage={loadCoverImage}
              />
              <span className="block h-[98px] px-[15px] pt-4 pb-4">
                <span className="flex h-5 min-w-0 items-center gap-2 group-hover:pr-[22px] group-focus-within:pr-[22px]">
                  <SiteSymbol />
                  <span
                    className="truncate text-[14px] leading-5 tracking-[0.2px]"
                    title={site.name}
                  >
                    {site.name}
                  </span>
                </span>
                <span className="mt-1 block text-[12px] leading-4 tracking-[0.2px] text-[#72727e]">
                  {isNew ? 'Created' : 'Edited'}{' '}
                  {relativeTime(site.updatedAt, now)}
                </span>
                <span className="mt-1 block">
                  <SiteMemberPreview site={site} />
                </span>
              </span>
            </SiteLink>
            <span
              className="absolute right-[7px] top-[191px] z-10 grid size-5 place-items-center text-[#72727e] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
              data-site-overflow-reserve=""
              aria-hidden="true"
            >
              <AppSymbol className="!size-4 text-[18px]" weight={100}>
                more_vert
              </AppSymbol>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function SiteList({
  navigate,
  now,
  sites,
}: {
  navigate?: ((destination: string) => void) | undefined;
  now: Date;
  sites: readonly SiteSummary[];
}) {
  return (
    <div className="max-w-full overflow-x-auto">
      <table
        aria-label="Sites list"
        className="w-full min-w-[620px] table-fixed border-separate border-spacing-0 text-left"
      >
        <thead className="text-[12px] font-normal text-site-meta">
          <tr>
            <th className="w-1/2 px-0 py-2 font-normal" scope="col">
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
          {sites.map((site) => (
            <tr className="group text-[14px]" key={site.id}>
              <td className="h-11 py-1 pr-3">
                <div className="flex min-w-0 items-center gap-2">
                  <SiteSymbol />
                  <SiteLink
                    className="min-w-0 truncate rounded font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    navigate={navigate}
                    site={site}
                  >
                    {site.name}
                  </SiteLink>
                  <span
                    className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                    aria-hidden="true"
                  >
                    <AppSymbol className="!size-4 text-[18px]" weight={100}>
                      more_vert
                    </AppSymbol>
                  </span>
                </div>
              </td>
              <td className="px-3 py-1 text-[12px] text-site-row">
                {relativeTime(site.updatedAt, now)}
              </td>
              <td className="px-3 py-1 text-[12px] text-site-row">
                {relativeTime(site.createdAt, now)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SiteCollection({
  loadCoverImage,
  navigate,
  now = new Date(),
  sites,
}: {
  loadCoverImage?: CoverImageLoader | undefined;
  navigate?: ((destination: string) => void) | undefined;
  now?: Date;
  sites: readonly SiteSummary[];
}) {
  const [view, setView] = useState<SiteView>('grid');
  return (
    <section className="min-h-[calc(100vh-68px)] bg-[#fafafa] px-8 py-6 max-md:px-5">
      <div className="mb-4 flex justify-end">
        <SiteViewControl onChange={setView} view={view} />
      </div>
      {view === 'grid' ? (
        <SiteGrid
          navigate={navigate}
          now={now}
          sites={sites}
          loadCoverImage={loadCoverImage}
        />
      ) : (
        <SiteList navigate={navigate} now={now} sites={sites} />
      )}
    </section>
  );
}
