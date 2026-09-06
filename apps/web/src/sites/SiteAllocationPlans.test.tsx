import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  DashboardResponse,
  SiteActivityResponse,
  SitesPageResponse,
} from '@hansel/contracts';
import { SiteAllocationPlans } from './SiteActivity.js';

afterEach(cleanup);

const dashboard: DashboardResponse = {
  viewer: { displayName: 'Nabin Singh', initials: 'NS', roleLabel: 'Owner' },
};
const siteId = 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9';
const site = {
  id: siteId,
  name: 'Sydney Central',
  createdAt: '2026-09-05T10:00:00.000Z',
  updatedAt: '2026-09-05T10:00:00.000Z',
  memberCount: 0,
  memberPreview: [],
};
const olderSite = {
  ...site,
  id: 'c1745b68-2885-45dd-9f05-7a35f9466c1c',
  name: 'Older Site',
  createdAt: '2026-09-04T10:00:00.000Z',
  updatedAt: '2026-09-04T10:00:00.000Z',
};
const sitesPage: SitesPageResponse = {
  organizationName: 'Hansel',
  canCreateSite: true,
  canInviteMembers: true,
  creator: {
    email: 'owner@example.com',
    displayName: 'Nabin Singh',
    initials: 'NS',
  },
  siteLimitReached: false,
  maximumSites: null,
  members: [],
  sites: [site, olderSite],
};
const props = {
  loadDashboard: () => Promise.resolve(dashboard),
  loadSite: () =>
    Promise.resolve({ site: { id: siteId, name: 'Sydney Central' } }),
  loadSites: () => Promise.resolve(sitesPage),
  logout: () => Promise.resolve(),
};

describe('SiteAllocationPlans [site-allocation-plans-empty-state REQ-001..REQ-023]', () => {
  it('renders and filters the Figma Allocation Plan collection without refetching [site-allocation-plans-add REQ-025, AC-008]', async () => {
    const navigate = vi.fn();
    const loadAllocationPlans = vi.fn(() =>
      Promise.resolve({
        canAddPlans: true,
        plans: [
          {
            id: '00000000-0000-4000-8000-000000000006',
            filename: 'Ground Floor.pdf',
            mediaType: 'application/pdf' as const,
            byteSize: 1048576,
            createdAt: '2026-09-04T00:00:00.000Z',
            modifiedAt: '2026-09-05T00:00:00.000Z',
            uploadedBy: 'Nabin Singh',
          },
          {
            id: '00000000-0000-4000-8000-000000000007',
            filename: 'First Floor.png',
            mediaType: 'image/png' as const,
            byteSize: 512,
            createdAt: '2026-09-04T00:00:00.000Z',
            modifiedAt: '2026-09-04T00:00:00.000Z',
            uploadedBy: 'Nabin Singh',
          },
        ],
      }),
    );
    render(
      <SiteAllocationPlans
        {...props}
        loadAllocationPlans={loadAllocationPlans}
        createAllocationPlanUploadBatch={() =>
          Promise.reject(new Error('unused'))
        }
        uploadAllocationPlan={() => Promise.reject(new Error('unused'))}
        finalizeAllocationPlanUpload={() => Promise.reject(new Error('unused'))}
        navigate={navigate}
      />,
    );
    const grid = await screen.findByRole('list', {
      name: 'Allocation Plans',
    });
    expect(within(grid).getByText('Ground Floor.pdf')).toBeVisible();
    expect(
      within(grid).getByRole('link', { name: /Ground Floor\.pdf/ }),
    ).toHaveAttribute(
      'href',
      `/sites/${siteId}/allocations/00000000-0000-4000-8000-000000000006`,
    );
    fireEvent.click(
      within(grid).getByRole('link', { name: /Ground Floor\.pdf/ }),
    );
    expect(navigate).toHaveBeenCalledWith(
      `/sites/${siteId}/allocations/00000000-0000-4000-8000-000000000006`,
    );
    expect(within(grid).getByText('First Floor.png')).toBeVisible();
    expect(within(grid).getByText('Edited 1 day ago')).toBeVisible();
    expect(within(grid).getByText('Created 2 days ago')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    const search = screen.getByRole('searchbox', { name: 'Search plans' });
    fireEvent.change(search, { target: { value: 'gRoUnD' } });
    expect(within(grid).getByText('Ground Floor.pdf')).toBeVisible();
    expect(within(grid).queryByText('First Floor.png')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    const table = screen.getByRole('table', { name: 'Allocation Plans' });
    for (const heading of ['Name', 'Last modified', 'Created'])
      expect(
        within(table).getByRole('columnheader', { name: heading }),
      ).toBeVisible();
    expect(within(table).getByText('Ground Floor.pdf')).toBeVisible();
    expect(within(table).queryByText('First Floor.png')).toBeNull();
    expect(loadAllocationPlans).toHaveBeenCalledOnce();
    fireEvent.change(search, { target: { value: '' } });
    expect(within(table).getByText('First Floor.png')).toBeVisible();
    fireEvent.click(
      within(table).getByRole('link', { name: 'First Floor.png' }),
    );
    expect(navigate).toHaveBeenLastCalledWith(
      `/sites/${siteId}/allocations/00000000-0000-4000-8000-000000000007`,
    );
    fireEvent.change(search, { target: { value: 'roof' } });
    expect(screen.getByText('No plans match your search.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Grid view' }));
    expect(screen.getByText('No plans match your search.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Add plan' }));
    expect(screen.getByRole('dialog', { name: 'Add plans' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Close Add plans' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
  it('renders the exact truthful Figma empty state in the shared Site shell [REQ-001, REQ-004..REQ-013, REQ-015..REQ-018, REQ-023; AC-001, AC-002, AC-005]', async () => {
    const navigate = vi.fn();
    render(<SiteAllocationPlans {...props} navigate={navigate} />);

    expect(
      await screen.findByRole('heading', {
        name: 'Sydney Central Allocation Plans',
        level: 1,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'No plans', level: 2 }),
    ).toBeVisible();
    expect(screen.getByText('Upload an architectural plan')).toBeVisible();
    expect(
      screen.getByText('or plot your signage on Google Maps'),
    ).toBeVisible();

    const application = screen.getByRole('navigation', {
      name: 'Application',
    });
    expect(
      within(application).getByRole('link', { name: 'Sydney Central' }),
    ).toHaveAttribute('aria-current', 'page');
    const siteNavigation = within(application).getByRole('list', {
      name: 'Sites',
    });
    const siteLinks = within(siteNavigation).getAllByRole('link');
    expect(siteLinks).toHaveLength(2);
    expect(siteLinks[0]).toHaveAccessibleName('Sydney Central');
    expect(siteLinks[1]).toHaveAccessibleName('Older Site');
    expect(
      within(application).getByRole('link', { name: 'Sites' }),
    ).not.toHaveAttribute('aria-current');

    const sections = screen.getByRole('navigation', { name: 'Site sections' });
    expect(sections).toHaveClass('overflow-x-auto');
    expect(sections).toHaveClass('[scrollbar-width:none]');
    expect(sections).toHaveClass('[&::-webkit-scrollbar]:hidden');
    expect(
      within(sections).getByRole('link', {
        name: 'Allocations',
        current: 'page',
      }),
    ).toHaveAttribute('href', `/sites/${siteId}/allocations`);
    expect(
      within(sections).getByRole('link', { name: 'Activity' }),
    ).toHaveAttribute('href', `/sites/${siteId}/activity`);
    expect(within(sections).getByText('Signage Schedule')).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    for (const action of [
      'Add plan',
      'Use Google Maps',
      'Share site',
      'Share options',
      'Notifications',
      'Site settings',
    ])
      expect(screen.getByRole('button', { name: action })).toBeDisabled();

    expect(screen.queryByRole('list', { name: 'Allocation Plans' })).toBeNull();
    fireEvent.click(within(sections).getByRole('link', { name: 'Activity' }));
    expect(navigate).toHaveBeenCalledWith(`/sites/${siteId}/activity`);
  });

  it('shows the generic preview failure when a linked plan no longer exists [site-allocation-plan-preview AC-003]', async () => {
    render(
      <SiteAllocationPlans
        {...props}
        loadAllocationPlanContent={() => Promise.resolve(new Blob())}
        loadAllocationPlans={() =>
          Promise.resolve({ canAddPlans: true, plans: [] })
        }
        previewPlanId="00000000-0000-4000-8000-000000000099"
      />,
    );

    expect(
      await screen.findByText(
        'We couldn’t display this plan. Please try again.',
      ),
    ).toBeVisible();
  });

  it('validates the session before starting both established Site reads together [REQ-002, REQ-014, REQ-021; AC-004]', async () => {
    let resolveDashboard: ((value: DashboardResponse) => void) | undefined;
    let resolveSite: ((value: SiteActivityResponse) => void) | undefined;
    let resolveSites: ((value: SitesPageResponse) => void) | undefined;
    const loadDashboard = vi.fn(
      () =>
        new Promise<DashboardResponse>((resolve) => {
          resolveDashboard = resolve;
        }),
    );
    const loadSite = vi.fn(
      () =>
        new Promise<SiteActivityResponse>((resolve) => {
          resolveSite = resolve;
        }),
    );
    const loadSites = vi.fn(
      () =>
        new Promise<SitesPageResponse>((resolve) => {
          resolveSites = resolve;
        }),
    );
    render(
      <SiteAllocationPlans
        {...props}
        loadDashboard={loadDashboard}
        loadSite={loadSite}
        loadSites={loadSites}
      />,
    );

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(loadSite).not.toHaveBeenCalled();
    expect(loadSites).not.toHaveBeenCalled();
    act(() => {
      resolveDashboard?.(dashboard);
    });
    await waitFor(() => {
      expect(loadSite).toHaveBeenCalledOnce();
      expect(loadSites).toHaveBeenCalledOnce();
    });
    act(() => {
      resolveSite?.({ site: { id: siteId, name: 'Sydney Central' } });
      resolveSites?.(sitesPage);
    });
    expect(
      await screen.findByRole('heading', { name: 'No plans' }),
    ).toBeVisible();
  });

  it('fails closed on an inconsistent Site and exposes no context [REQ-001, REQ-003, REQ-019; AC-003]', async () => {
    render(
      <SiteAllocationPlans
        {...props}
        loadSites={() =>
          Promise.resolve({
            ...sitesPage,
            sites: [{ ...site, name: 'Different Site' }],
          })
        }
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't load this site.",
    );
    expect(screen.queryByText('Sydney Central')).not.toBeInTheDocument();
    expect(screen.queryByText('Hansel')).not.toBeInTheDocument();
  });

  it('retries both Site reads without retaining stale content [REQ-003, REQ-014, REQ-021; AC-004]', async () => {
    const loadSite = vi
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce({ site: { id: siteId, name: 'Sydney Central' } });
    const loadSites = vi.fn(() => Promise.resolve(sitesPage));
    render(
      <SiteAllocationPlans
        {...props}
        loadSite={loadSite}
        loadSites={loadSites}
      />,
    );

    expect(await screen.findByRole('alert')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByRole('heading', { name: 'No plans' }),
    ).toBeVisible();
    expect(loadSite).toHaveBeenCalledTimes(2);
    expect(loadSites).toHaveBeenCalledTimes(2);
  });

  it('renders authorized names as text and uses no persistence or extra read seam [REQ-006, REQ-007, REQ-019, REQ-022]', async () => {
    const hostileSite = '<img src=x onerror=alert(1)>';
    const hostileOrganization = '<strong>Owned</strong>';
    const localStorageWrite = vi.spyOn(Storage.prototype, 'setItem');
    const loadSite = vi.fn(() =>
      Promise.resolve({ site: { id: siteId, name: hostileSite } }),
    );
    const loadSites = vi.fn(() =>
      Promise.resolve({
        ...sitesPage,
        organizationName: hostileOrganization,
        sites: [{ ...site, name: hostileSite }],
      }),
    );
    const { container } = render(
      <SiteAllocationPlans
        {...props}
        loadSite={loadSite}
        loadSites={loadSites}
      />,
    );

    expect(
      await screen.findByRole('heading', {
        name: `${hostileSite} Allocation Plans`,
      }),
    ).toBeVisible();
    expect(screen.getByText(hostileOrganization)).toBeVisible();
    expect(container.querySelector('img[src="x"]')).not.toBeInTheDocument();
    expect(container.querySelector('strong')).not.toBeInTheDocument();
    expect(loadSite).toHaveBeenCalledOnce();
    expect(loadSites).toHaveBeenCalledOnce();
    expect(localStorageWrite).not.toHaveBeenCalled();
  });

  it('removes obsolete Site context before a changed read settles [REQ-003, REQ-014, REQ-021; AC-003, AC-004]', async () => {
    const view = render(<SiteAllocationPlans {...props} />);
    expect(
      await screen.findByRole('heading', { name: 'No plans' }),
    ).toBeVisible();

    view.rerender(
      <SiteAllocationPlans
        {...props}
        loadSite={() => Promise.reject(new Error('unavailable'))}
      />,
    );

    expect(screen.queryByText('Sydney Central')).not.toBeInTheDocument();
    expect(screen.queryByText('Hansel')).not.toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't load this site.",
    );
  });
});
