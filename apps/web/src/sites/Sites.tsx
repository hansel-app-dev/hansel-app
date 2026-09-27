/** @spec sites-empty-state REQ-001..REQ-013 @spec sites-add-new REQ-001, REQ-012, REQ-017..REQ-021 @spec sites-populated-state REQ-001, REQ-004..REQ-025 @figma 2024:9828, 2029:1630, 2025:11221, 2043:3580 */
import { useEffect, useState } from 'react';
import type {
  CreateSiteRequest,
  CreateSiteResponse,
  DashboardResponse,
  SitesPageResponse,
} from '@hansel/contracts';
import { Button } from '../design-system/index.js';
import {
  ApplicationShell,
  AppSymbol,
  NotificationSymbol,
} from '../application-shell/ApplicationShell.js';
import { AddSiteModal } from './AddSiteModal.js';
import { SiteCollection } from './SiteCollection.js';
import type { CoverImageLoader } from './SiteCoverImage.js';

function NewSiteButton({
  compact = false,
  disabled,
  onClick,
}: {
  compact?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      className={compact ? 'min-h-9 px-4 py-2' : 'mt-6'}
      disabled={disabled}
      onClick={onClick}
    >
      <AppSymbol className="mr-2 !size-4 text-[18px]">add</AppSymbol>
      New site
    </Button>
  );
}

export interface SitesProps {
  loadCoverImage?: CoverImageLoader;
  uploadCoverImage?: (siteId: string, file: File) => Promise<void>;
  coverImageEnabled?: boolean;
  createSite: (input: CreateSiteRequest) => Promise<CreateSiteResponse>;
  loadDashboard: () => Promise<DashboardResponse>;
  loadSites: () => Promise<SitesPageResponse>;
  logout: () => Promise<void>;
  navigate?: (destination: string) => void;
  now?: Date;
  preloadedDashboard?: DashboardResponse;
}

export function Sites({
  loadCoverImage,
  uploadCoverImage,
  coverImageEnabled = false,
  createSite,
  loadDashboard,
  loadSites,
  logout,
  navigate,
  now,
  preloadedDashboard,
}: SitesProps) {
  const [page, setPage] = useState<SitesPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const load = () => {
    setLoading(true);
    setPage(null);
    setLoadError(false);
    void loadSites()
      .then((nextPage) => {
        setPage(nextPage);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setLoadError(true);
      });
  };
  useEffect(load, [loadSites]);
  const openModal = () => {
    setModalOpen(true);
  };
  const createDisabled = !page?.canCreateSite || page.siteLimitReached;

  return (
    <ApplicationShell
      activePage="Sites"
      loadDashboard={loadDashboard}
      loadErrorMessage="We couldn't load your account. Please try again."
      logout={logout}
      navigate={navigate}
      preloadedDashboard={preloadedDashboard}
      siteNavigation={page?.sites}
      workspaceName={page?.sites.length ? page.organizationName : undefined}
      headerActions={
        <>
          <NotificationSymbol />
          <NewSiteButton
            compact
            disabled={createDisabled}
            onClick={openModal}
          />
        </>
      }
    >
      {page?.siteLimitReached ? (
        <p
          className="mx-8 mt-6 rounded-control border border-control-border bg-surface-muted px-4 py-3 text-sm text-content-muted max-md:mx-5"
          role="status"
        >
          Your current plan has reached its site limit.
        </p>
      ) : null}
      {loadError ? (
        <section className="grid min-h-[calc(100vh-68px)] place-items-center px-5 text-center">
          <div>
            <p className="text-sm text-danger" role="alert">
              We couldn't load sites. Please try again.
            </p>
            <Button className="mt-4" onClick={load} variant="secondary">
              Retry
            </Button>
          </div>
        </section>
      ) : loading ? (
        <section className="grid min-h-[calc(100vh-68px)] place-items-center px-5 text-center">
          <p className="text-sm text-content-muted" role="status">
            Loading sites…
          </p>
        </section>
      ) : page?.sites.length ? (
        <SiteCollection
          loadCoverImage={loadCoverImage}
          navigate={navigate}
          sites={page.sites}
          {...(now ? { now } : {})}
        />
      ) : (
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
            <img
              src="/assets/site-icon.svg"
              alt=""
              aria-hidden="true"
              width={68}
              height={68}
              className="size-[68px]"
            />
            <h2
              id="sites-empty-heading"
              className="mt-5 text-[18px] font-semibold leading-7"
            >
              No sites
            </h2>
            <p className="mt-1 text-[15px] leading-6 text-[#737373]">
              Create a new site to get started.
            </p>
            <NewSiteButton disabled={createDisabled} onClick={openModal} />
          </div>
        </section>
      )}
      {modalOpen && page ? (
        <AddSiteModal
          {...(uploadCoverImage ? { uploadCoverImage } : {})}
          canInviteMembers={page.canInviteMembers}
          coverImageEnabled={page.siteCoverImageEnabled ?? coverImageEnabled}
          createSite={createSite}
          creator={page.creator}
          members={page.members}
          onClose={() => {
            setModalOpen(false);
          }}
          onCreated={(destination) => {
            setModalOpen(false);
            navigate?.(destination);
          }}
          organizationName={page.organizationName}
        />
      ) : null}
    </ApplicationShell>
  );
}
