import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sites } from './Sites.js';

afterEach(cleanup);

const viewer = {
  viewer: { displayName: 'Nabin Singh', initials: 'NS', roleLabel: 'Owner' },
};
const emptyPage = {
  organizationName: 'Hansel',
  canCreateSite: true,
  canInviteMembers: true,
  creator: {
    email: 'owner@example.com',
    displayName: 'Owner',
    initials: 'O',
  },
  siteLimitReached: false,
  maximumSites: null,
  members: [],
  sites: [],
};
const props = {
  createSite: vi.fn(),
  loadDashboard: () => Promise.resolve(viewer),
  loadSites: () => Promise.resolve(emptyPage),
  logout: () => Promise.resolve(),
};
const sydneySite = {
  id: 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9',
  name: 'Sydney Central',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-09-01T11:00:00.000Z',
  memberCount: 1,
  memberPreview: [{ displayName: 'Nabin Singh', initials: 'NS' }],
};

describe('Sites [sites-empty-state REQ-001..REQ-013, sites-add-new REQ-001, REQ-012]', () => {
  it('shows a truthful loading state until site data is available [sites-populated-state REQ-017, REQ-022]', async () => {
    let resolveSites: ((page: typeof emptyPage) => void) | undefined;
    const loadSites = () =>
      new Promise<typeof emptyPage>((resolve) => {
        resolveSites = resolve;
      });
    render(<Sites {...props} loadSites={loadSites} />);

    expect(screen.getByText('Loading sites…')).toHaveAttribute(
      'role',
      'status',
    );
    expect(screen.queryByText('No sites')).not.toBeInTheDocument();
    resolveSites?.(emptyPage);
    expect(await screen.findByText('No sites')).toBeVisible();
    const icon = screen
      .getByRole('region', { name: 'No sites' })
      .querySelector('img');
    expect(icon).toHaveAttribute('src', '/assets/site-icon.svg');
    expect(icon).toHaveAttribute('alt', '');
    expect(icon).toHaveAttribute('width', '68');
  });

  it('opens the same add-site modal from both Figma actions', async () => {
    render(<Sites {...props} />);
    expect(await screen.findByText('Nabin Singh')).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: 'New site' })[0],
      ).toBeEnabled(),
    );
    const actions = screen.getAllByRole('button', { name: 'New site' });
    expect(actions).toHaveLength(3);
    const firstAction = actions.at(0);
    const secondAction = actions.at(1);
    if (!firstAction || !secondAction)
      throw new Error('Expected both New site actions');
    fireEvent.click(firstAction);
    expect(screen.getByRole('dialog', { name: 'Add new site' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(secondAction);
    expect(screen.getByRole('dialog', { name: 'Add new site' })).toBeVisible();

    const navigation = within(
      screen.getByRole('navigation', { name: 'Application' }),
    );
    expect(
      navigation.getByRole('link', { name: 'My Sites 0' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('shows tenant-owned sites instead of an incorrect empty state and navigates client-side [sites-populated-state REQ-002, REQ-006, REQ-010]', async () => {
    const navigate = vi.fn();
    render(
      <Sites
        {...props}
        loadSites={() =>
          Promise.resolve({
            ...emptyPage,
            sites: [sydneySite],
          })
        }
        navigate={navigate}
      />,
    );
    const links = await screen.findAllByRole('link', {
      name: 'Sydney Central',
    });
    expect(screen.queryByText('No sites')).not.toBeInTheDocument();
    expect(links).toHaveLength(2);
    const sidebarLink = links.at(0);
    const cardLink = links.at(1);
    if (!sidebarLink || !cardLink)
      throw new Error('Expected sidebar and grid card links');
    fireEvent.click(sidebarLink);
    fireEvent.click(cardLink);
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenLastCalledWith(
      `/sites/${sydneySite.id}/activity`,
    );
  });

  it('preserves one newest-first collection across the sidebar, grid, and list [sites-populated-state REQ-001, REQ-004..REQ-010; sites-latest-first REQ-003, REQ-007]', async () => {
    const olderSite = {
      ...sydneySite,
      id: 'c1745b68-2885-45dd-9f05-7a35f9466c1c',
      name: 'Alpha Older',
      createdAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-01T10:00:00.000Z',
    };
    const latestSite = {
      ...sydneySite,
      name: 'Zulu Latest',
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    };
    const loadSites = vi
      .fn()
      .mockResolvedValue({ ...emptyPage, sites: [latestSite, olderSite] });
    render(
      <Sites
        {...props}
        loadSites={loadSites}
        now={new Date('2026-09-05T12:00:00.000Z')}
      />,
    );

    const navigation = within(
      screen.getByRole('navigation', { name: 'Application' }),
    );
    const sidebarSites = within(
      await navigation.findByRole('list', { name: 'My Sites' }),
    );
    const expectedDestinations = [
      `/sites/${latestSite.id}/activity`,
      `/sites/${olderSite.id}/activity`,
    ];
    expect(
      sidebarSites
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(expectedDestinations);
    expect(
      sidebarSites.getByRole('link', { name: 'Zulu Latest' }),
    ).toHaveAttribute('href', `/sites/${latestSite.id}/activity`);
    const grid = screen.getByRole('list', { name: 'Sites grid' });
    expect(within(grid).getAllByRole('listitem')).toHaveLength(2);
    expect(
      within(grid)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(expectedDestinations);
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(
      within(screen.getByRole('table', { name: 'Sites list' }))
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(expectedDestinations);
    expect(screen.queryByText('Your sites')).not.toBeInTheDocument();
    expect(screen.queryByText('2 sites')).not.toBeInTheDocument();
    expect(screen.getByText('Hansel')).toBeVisible();
    expect(loadSites).toHaveBeenCalledOnce();
  });

  it('switches accessibly between the Figma grid and list without refetching or changing navigation [sites-populated-state REQ-015, REQ-020, REQ-025]', async () => {
    const loadSites = vi
      .fn()
      .mockResolvedValue({ ...emptyPage, sites: [sydneySite] });
    render(<Sites {...props} loadSites={loadSites} />);

    await screen.findByRole('list', { name: 'Sites grid' });
    const gridButton = screen.getByRole('button', { name: 'Grid view' });
    const listButton = screen.getByRole('button', { name: 'List view' });
    expect(gridButton).toHaveAttribute('aria-pressed', 'true');
    expect(listButton).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(listButton);

    expect(
      screen.queryByRole('list', { name: 'Sites grid' }),
    ).not.toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Sites list' });
    expect(
      within(table).getByRole('columnheader', { name: 'Name' }),
    ).toBeVisible();
    expect(
      within(table).getByRole('columnheader', { name: 'Last modified' }),
    ).toBeVisible();
    expect(
      within(table).getByRole('columnheader', { name: 'Created' }),
    ).toBeVisible();
    expect(
      within(table).getByRole('link', { name: 'Sydney Central' }),
    ).toHaveAttribute('href', `/sites/${sydneySite.id}/activity`);
    expect(listButton).toHaveAttribute('aria-pressed', 'true');
    expect(loadSites).toHaveBeenCalledOnce();
  });

  it('collapses and restores only the populated nested Sites navigation [sites-populated-state REQ-005..REQ-007]', async () => {
    render(
      <Sites
        {...props}
        loadSites={() => Promise.resolve({ ...emptyPage, sites: [sydneySite] })}
      />,
    );
    await screen.findByRole('list', { name: 'Sites grid' });
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sites' }));
    const navigation = within(
      screen.getByRole('navigation', { name: 'Application' }),
    );
    expect(
      navigation.queryByRole('link', { name: 'Sydney Central' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Sites grid' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sites' }));
    expect(
      navigation.getByRole('link', { name: 'Sydney Central' }),
    ).toBeVisible();
  });

  it('renders plural populated sites and preserves normal link behavior without a client navigator [sites-populated-state REQ-006, REQ-010, REQ-018]', async () => {
    const first = 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9';
    const second = 'c1745b68-2885-45dd-9f05-7a35f9466c1c';
    render(
      <Sites
        {...props}
        loadSites={() =>
          Promise.resolve({
            ...emptyPage,
            sites: [
              { ...sydneySite, id: first, name: 'Sydney' },
              { ...sydneySite, id: second, name: 'Melbourne' },
            ],
          })
        }
      />,
    );
    const grid = await screen.findByRole('list', { name: 'Sites grid' });
    const prevent = vi.fn((event: MouseEvent) => {
      event.preventDefault();
    });
    document.addEventListener('click', prevent);
    fireEvent.click(within(grid).getByRole('link', { name: 'Sydney' }));
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Application' })).getByRole(
        'link',
        { name: 'Sydney' },
      ),
    );
    document.removeEventListener('click', prevent);
    expect(prevent).toHaveBeenCalledTimes(2);
  });

  it('offers a focused retry when the sites context is unavailable', async () => {
    let attempts = 0;
    render(
      <Sites
        {...props}
        loadSites={() => {
          attempts += 1;
          return attempts === 1
            ? Promise.reject(new Error('unavailable'))
            : Promise.resolve(emptyPage);
        }}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't load sites",
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No sites')).toBeVisible();
  });

  it('clears stale populated sites before a replacement load fails [sites-populated-state REQ-017, REQ-023]', async () => {
    const firstLoad = () =>
      Promise.resolve({ ...emptyPage, sites: [sydneySite] });
    const { rerender } = render(<Sites {...props} loadSites={firstLoad} />);
    await screen.findByRole('list', { name: 'Sites grid' });

    rerender(
      <Sites
        {...props}
        loadSites={() => Promise.reject(new Error('unavailable'))}
      />,
    );

    expect(screen.queryByRole('list', { name: 'Sites grid' })).toBeNull();
    expect(
      within(
        screen.getByRole('navigation', { name: 'Application' }),
      ).queryByRole('link', { name: 'Sydney Central' }),
    ).toBeNull();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't load sites",
    );
  });

  it('disables both creation actions and explains a reached plan limit', async () => {
    render(
      <Sites
        {...props}
        loadSites={() =>
          Promise.resolve({
            ...emptyPage,
            siteLimitReached: true,
            maximumSites: 1,
            sites: [{ ...sydneySite, name: 'Only site' }],
          })
        }
      />,
    );
    expect(await screen.findByText(/reached its site limit/)).toBeVisible();
    for (const action of screen.getAllByRole('button', { name: 'New site' }))
      expect(action).toBeDisabled();
  });
});
