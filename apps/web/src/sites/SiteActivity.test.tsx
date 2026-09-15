import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  SiteActivityResponse,
  SitesPageResponse,
} from '@hansel/contracts';
import {
  SiteActivity,
  SiteAllocationPlans,
  SiteSignageSchedule,
} from './SiteActivity.js';

afterEach(cleanup);

const viewer = {
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
  sites: [site],
};
const props = {
  loadDashboard: () => Promise.resolve(viewer),
  loadSites: () => Promise.resolve(sitesPage),
  logout: () => Promise.resolve(),
};

describe('SiteActivity [site-details-activity-shell REQ-001..REQ-021]', () => {
  it.each(['listing', 'details', 'schedule'])(
    'shares flat navigation in %s [site-section-tabs-consistency REQ-001..REQ-003]',
    async (view) => {
      const Component =
        view === 'schedule' ? SiteSignageSchedule : SiteAllocationPlans;
      const navigate = vi.fn();
      render(
        <Component
          {...props}
          loadSite={() => Promise.resolve({ site })}
          navigate={navigate}
          {...(view === 'details' ? { previewPlanId: 'example-plan' } : {})}
        />,
      );
      const navigation = await screen.findByRole('navigation', {
        name: 'Site sections',
      });
      expect(navigation).toHaveClass(
        '-mx-8',
        'max-md:-mx-5',
        'border-b',
        'overflow-x-auto',
      );
      expect(navigation).not.toHaveClass(
        'rounded',
        'border',
        'shadow-site-card',
      );
      expect(navigation.parentElement).not.toHaveClass('py-8');
      expect(
        within(navigation).getByRole('link', {
          name: view === 'schedule' ? 'Signage Schedule' : 'Allocations',
        }),
      ).toHaveAttribute('aria-current', 'page');
      fireEvent.click(
        within(navigation).getByRole('link', { name: 'Activity' }),
      );
      expect(navigate).toHaveBeenCalledWith(`/sites/${siteId}/activity`);
    },
  );
  it('combines the authorized Site identity and Sites context in one loaded shell [site-details-activity-shell REQ-003..REQ-007]', async () => {
    let resolveActivity: ((value: SiteActivityResponse) => void) | undefined;
    let resolveSites: ((value: SitesPageResponse) => void) | undefined;
    const loadActivity = vi.fn(
      () =>
        new Promise<SiteActivityResponse>((done) => {
          resolveActivity = done;
        }),
    );
    const loadSites = vi.fn(
      () =>
        new Promise<SitesPageResponse>((done) => {
          resolveSites = done;
        }),
    );
    render(
      <SiteActivity
        {...props}
        loadActivity={loadActivity}
        loadSites={loadSites}
      />,
    );
    await waitFor(() => {
      expect(loadActivity).toHaveBeenCalledOnce();
      expect(loadSites).toHaveBeenCalledOnce();
    });
    expect(screen.getByText('Loading site…')).toHaveAttribute('role', 'status');
    resolveActivity?.({ site: { id: siteId, name: 'Sydney Central' } });
    resolveSites?.(sitesPage);
    expect(
      await screen.findByRole('heading', { name: 'Sydney Central' }),
    ).toBeVisible();
    expect(screen.getByText('Hansel')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Sydney Central' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getByRole('navigation', { name: 'Site sections' }),
    ).toHaveTextContent('Activity');

    const prevent = vi.fn((event: MouseEvent) => {
      event.preventDefault();
    });
    document.addEventListener('click', prevent);
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    fireEvent.click(screen.getByRole('link', { name: 'Activity' }));
    fireEvent.click(
      within(
        screen.getByRole('navigation', { name: 'Site breadcrumb' }),
      ).getByRole('link', { name: 'Sites' }),
    );
    document.removeEventListener('click', prevent);
    expect(prevent).toHaveBeenCalledTimes(3);
  });

  it('uses the safe unavailable state', async () => {
    render(
      <SiteActivity
        {...props}
        loadActivity={() => Promise.reject(new Error('private'))}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "couldn't load this site",
    );
  });

  it('uses only the established read seams and adds no client persistence [site-details-activity-shell REQ-021]', async () => {
    const loadDashboard = vi.fn(() => Promise.resolve(viewer));
    const loadActivity = vi.fn(() =>
      Promise.resolve({ site: { id: siteId, name: 'Sydney Central' } }),
    );
    const loadSites = vi.fn(() => Promise.resolve(sitesPage));
    const localStorageWrite = vi.spyOn(Storage.prototype, 'setItem');

    render(
      <SiteActivity
        {...props}
        loadActivity={loadActivity}
        loadDashboard={loadDashboard}
        loadSites={loadSites}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Sydney Central' }),
    ).toBeVisible();
    expect(loadDashboard).toHaveBeenCalledOnce();
    expect(loadActivity).toHaveBeenCalledOnce();
    expect(loadSites).toHaveBeenCalledOnce();
    expect(localStorageWrite).not.toHaveBeenCalled();
  });

  it('fails closed when the selected Site identity disagrees with the visible Sites collection [site-details-activity-shell REQ-004, AC-003]', async () => {
    render(
      <SiteActivity
        {...props}
        loadActivity={() =>
          Promise.resolve({ site: { id: siteId, name: 'Sydney Central' } })
        }
        loadSites={() =>
          Promise.resolve({
            ...sitesPage,
            sites: [{ ...site, name: 'Different Site' }],
          })
        }
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "couldn't load this site",
    );
    expect(
      screen.queryByRole('heading', { name: 'Sydney Central' }),
    ).not.toBeInTheDocument();
  });

  it('retries both Site reads without retaining stale content [site-details-activity-shell REQ-013, AC-004]', async () => {
    const loadActivity = vi
      .fn()
      .mockResolvedValue({ site: { id: siteId, name: 'Sydney Central' } });
    const loadSites = vi
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(sitesPage);
    render(
      <SiteActivity
        {...props}
        loadActivity={loadActivity}
        loadSites={loadSites}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "couldn't load this site",
    );
    expect(screen.queryByText('Hansel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(
      await screen.findByRole('heading', { name: 'Sydney Central' }),
    ).toBeVisible();
    expect(loadActivity).toHaveBeenCalledTimes(2);
    expect(loadSites).toHaveBeenCalledTimes(2);
  });

  it('renders the Figma-derived hierarchy without fabricated Activity data or actions [site-details-activity-shell REQ-001, REQ-007, REQ-009..REQ-012, AC-001, AC-002; site-allocation-plans-empty-state REQ-023]', async () => {
    render(
      <SiteActivity
        {...props}
        loadActivity={() =>
          Promise.resolve({ site: { id: siteId, name: 'Sydney Central' } })
        }
      />,
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Sydney Central',
        level: 1,
      }),
    ).toBeVisible();
    const breadcrumb = screen.getByRole('navigation', {
      name: 'Site breadcrumb',
    });
    expect(breadcrumb.querySelector('ol')).toHaveClass('items-center');
    expect(breadcrumb.querySelector('li[aria-hidden="true"]')).toHaveClass(
      'flex',
      'items-center',
    );
    expect(within(breadcrumb).getByText('chevron_right')).toHaveClass(
      'items-center',
      'justify-center',
    );
    expect(
      within(breadcrumb).getByRole('link', { name: 'Sites' }),
    ).toHaveAttribute('href', '/sites');
    expect(within(breadcrumb).getByText('Sydney Central')).toHaveAttribute(
      'aria-current',
      'page',
    );
    for (const action of [
      'Share site',
      'Share options',
      'Notifications',
      'Site settings',
    ])
      expect(screen.getByRole('button', { name: action })).toBeDisabled();

    const sections = screen.getByRole('navigation', { name: 'Site sections' });
    expect(sections.parentElement).toHaveClass(
      'bg-[#fafafa]',
      'min-h-[calc(100vh-64px)]',
    );
    expect(sections).toHaveClass('items-center');
    // site-section-tabs-consistency REQ-001, REQ-003
    expect(sections).toHaveClass('-mx-8', 'max-md:-mx-5', 'border-b');
    expect(sections).not.toHaveClass('rounded', 'shadow-site-card', 'border');
    expect(sections.parentElement).not.toHaveClass('py-8');
    expect(sections).not.toHaveClass('items-end');
    expect(within(sections).queryByText('more_horiz')).not.toBeInTheDocument();
    expect(
      within(sections).getByRole('link', { name: 'Activity' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(sections).getByRole('link', { name: 'Allocations' }),
    ).toHaveAttribute('href', `/sites/${siteId}/allocations`);
    const preventNativeNavigation = vi.fn((event: MouseEvent) => {
      event.preventDefault();
    });
    document.addEventListener('click', preventNativeNavigation);
    fireEvent.click(
      within(sections).getByRole('link', { name: 'Allocations' }),
    );
    document.removeEventListener('click', preventNativeNavigation);
    expect(preventNativeNavigation).toHaveBeenCalledOnce();
    const signage = within(sections).getByRole('link', {
      name: 'Signage Schedule',
    });
    expect(signage).toHaveAttribute(
      'href',
      `/sites/${siteId}/signage-schedule`,
    );
    document.addEventListener('click', preventNativeNavigation);
    fireEvent.click(signage);
    document.removeEventListener('click', preventNativeNavigation);
    expect(
      screen.getAllByRole('heading', { name: 'Widget title', level: 2 }),
    ).toHaveLength(4);
    expect(screen.getByRole('region', { name: 'Activity' })).toHaveTextContent(
      'Site activity will appear here.',
    );
    expect(screen.queryByText(/invoice/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();
  });

  it('shows only the authorized bounded member preview and remainder [site-details-activity-shell REQ-008, AC-003]', async () => {
    render(
      <SiteActivity
        {...props}
        loadActivity={() =>
          Promise.resolve({ site: { id: siteId, name: 'Sydney Central' } })
        }
        loadSites={() =>
          Promise.resolve({
            ...sitesPage,
            sites: [
              {
                ...site,
                memberCount: 5,
                memberPreview: [
                  { displayName: 'John Doe', initials: 'JD' },
                  { displayName: 'Alex Smith', initials: 'AS' },
                  { displayName: 'Mary King', initials: 'MK' },
                ],
              },
            ],
          })
        }
      />,
    );

    expect(
      await screen.findByRole('group', {
        name: 'Members: John Doe, Alex Smith, Mary King; 2 more',
      }),
    ).toBeVisible();
    expect(screen.getByText('+2')).toBeVisible();
  });

  it('uses the established client-navigation seam for Site links [site-details-activity-shell REQ-002, REQ-014; site-allocation-plans-empty-state REQ-023]', async () => {
    const navigate = vi.fn();
    render(
      <SiteActivity
        {...props}
        loadActivity={() =>
          Promise.resolve({ site: { id: siteId, name: 'Sydney Central' } })
        }
        navigate={navigate}
      />,
    );

    const activity = await screen.findByRole('link', {
      name: 'Activity',
      current: 'page',
    });
    expect(screen.queryByText('more_horiz')).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(activity);
    expect(navigate).toHaveBeenLastCalledWith(`/sites/${siteId}/activity`);
    fireEvent.click(screen.getByRole('link', { name: 'Allocations' }));
    expect(navigate).toHaveBeenLastCalledWith(`/sites/${siteId}/allocations`);
    fireEvent.click(screen.getByRole('link', { name: 'Signage Schedule' }));
    expect(navigate).toHaveBeenLastCalledWith(
      `/sites/${siteId}/signage-schedule`,
    );
    fireEvent.click(
      within(
        screen.getByRole('navigation', { name: 'Site breadcrumb' }),
      ).getByRole('link', { name: 'Sites' }),
    );
    expect(navigate).toHaveBeenLastCalledWith('/sites');
  });

  it('announces exactly one loading status without a partial Site shell [site-details-activity-shell REQ-013, AC-004]', () => {
    render(
      <SiteActivity
        {...props}
        loadActivity={() => new Promise(() => undefined)}
        loadDashboard={() => new Promise(() => undefined)}
        loadSites={() => new Promise(() => undefined)}
      />,
    );

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Loading site…');
    expect(
      screen.queryByRole('navigation', { name: 'Site sections' }),
    ).not.toBeInTheDocument();
  });

  it('clears previously loaded Site context before a later failed read settles [site-details-activity-shell REQ-004, REQ-013, REQ-020]', async () => {
    const view = render(
      <SiteActivity
        {...props}
        loadActivity={() =>
          Promise.resolve({ site: { id: siteId, name: 'Sydney Central' } })
        }
      />,
    );
    expect(
      await screen.findByRole('heading', { name: 'Sydney Central' }),
    ).toBeVisible();

    view.rerender(
      <SiteActivity
        {...props}
        loadActivity={() => Promise.reject(new Error('unavailable'))}
      />,
    );

    expect(
      screen.queryByRole('heading', { name: 'Sydney Central' }),
    ).not.toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "couldn't load this site",
    );
    expect(screen.queryByText('Hansel')).not.toBeInTheDocument();
  });

  it('renders Organization, Site, and member values only as escaped text [site-details-activity-shell REQ-007, REQ-008, REQ-018, REQ-020]', async () => {
    const hostileSiteName = '<img src=x onerror=alert(1)>';
    const hostileOrganizationName = '<strong>Owned</strong>';
    const hostileMemberName = '<script>alert(1)</script>';
    const { container } = render(
      <SiteActivity
        {...props}
        loadActivity={() =>
          Promise.resolve({
            site: { id: siteId, name: hostileSiteName },
          })
        }
        loadSites={() =>
          Promise.resolve({
            ...sitesPage,
            organizationName: hostileOrganizationName,
            sites: [
              {
                ...site,
                name: hostileSiteName,
                memberCount: 1,
                memberPreview: [
                  { displayName: hostileMemberName, initials: '<>' },
                ],
              },
            ],
          })
        }
      />,
    );

    expect(
      await screen.findByRole('heading', { name: hostileSiteName }),
    ).toBeVisible();
    expect(screen.getByText(hostileOrganizationName)).toBeVisible();
    expect(
      screen.getByRole('group', { name: `Members: ${hostileMemberName}` }),
    ).toBeVisible();
    expect(container.querySelector('img[src="x"]')).not.toBeInTheDocument();
    expect(container.querySelector('script')).not.toBeInTheDocument();
    expect(container.innerHTML).toContain('&lt;strong&gt;Owned&lt;/strong&gt;');
  });

  it('does not begin Site reads after an obsolete session validation settles [site-details-activity-shell REQ-004]', async () => {
    let resolveDashboard: ((value: typeof viewer) => void) | undefined;
    const loadActivity = vi.fn(() => Promise.resolve({ site: site }));
    const loadSites = vi.fn(() => Promise.resolve(sitesPage));
    const view = render(
      <SiteActivity
        {...props}
        loadActivity={loadActivity}
        loadDashboard={() =>
          new Promise((done) => {
            resolveDashboard = done;
          })
        }
        loadSites={loadSites}
      />,
    );

    view.unmount();
    resolveDashboard?.(viewer);
    await Promise.resolve();
    expect(loadActivity).not.toHaveBeenCalled();
    expect(loadSites).not.toHaveBeenCalled();
  });

  it('ignores an obsolete pair of Site reads after navigation [site-details-activity-shell REQ-004]', async () => {
    let resolveActivity: ((value: SiteActivityResponse) => void) | undefined;
    let resolveSites: ((value: SitesPageResponse) => void) | undefined;
    const view = render(
      <SiteActivity
        {...props}
        loadActivity={() =>
          new Promise((done) => {
            resolveActivity = done;
          })
        }
        loadSites={() =>
          new Promise((done) => {
            resolveSites = done;
          })
        }
      />,
    );
    await waitFor(() => {
      expect(resolveActivity).toBeTypeOf('function');
      expect(resolveSites).toBeTypeOf('function');
    });

    view.unmount();
    resolveActivity?.({ site: { id: siteId, name: 'Sydney Central' } });
    resolveSites?.(sitesPage);
    await Promise.resolve();
  });
});
