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

describe('Sites [sites-empty-state REQ-001..REQ-013, sites-add-new REQ-001, REQ-012]', () => {
  it('opens the same add-site modal from both Figma actions', async () => {
    render(<Sites {...props} />);
    expect(await screen.findByText('Nabin Singh')).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: 'New site' })[0],
      ).toBeEnabled(),
    );
    const actions = screen.getAllByRole('button', { name: 'New site' });
    expect(actions).toHaveLength(2);
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
    expect(navigation.getByRole('link', { name: 'Sites' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows tenant-owned sites instead of an incorrect empty state and navigates client-side', async () => {
    const navigate = vi.fn();
    const siteId = 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9';
    render(
      <Sites
        {...props}
        loadSites={() =>
          Promise.resolve({
            ...emptyPage,
            sites: [{ id: siteId, name: 'Sydney Central' }],
          })
        }
        navigate={navigate}
      />,
    );
    const link = await screen.findByRole('link', { name: 'Sydney Central' });
    expect(screen.queryByText('No sites')).not.toBeInTheDocument();
    fireEvent.click(link);
    expect(navigate).toHaveBeenCalledWith(`/sites/${siteId}/activity`);
  });

  it('renders plural populated sites and preserves normal link behavior without a client navigator', async () => {
    const first = 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9';
    const second = 'c1745b68-2885-45dd-9f05-7a35f9466c1c';
    render(
      <Sites
        {...props}
        loadSites={() =>
          Promise.resolve({
            ...emptyPage,
            sites: [
              { id: first, name: 'Sydney' },
              { id: second, name: 'Melbourne' },
            ],
          })
        }
      />,
    );
    expect(await screen.findByText('2 sites')).toBeVisible();
    const prevent = vi.fn((event: MouseEvent) => {
      event.preventDefault();
    });
    document.addEventListener('click', prevent);
    fireEvent.click(screen.getByRole('link', { name: 'Sydney' }));
    document.removeEventListener('click', prevent);
    expect(prevent).toHaveBeenCalledOnce();
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

  it('disables both creation actions and explains a reached plan limit', async () => {
    render(
      <Sites
        {...props}
        loadSites={() =>
          Promise.resolve({
            ...emptyPage,
            siteLimitReached: true,
            maximumSites: 1,
            sites: [
              { id: 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9', name: 'Only site' },
            ],
          })
        }
      />,
    );
    expect(await screen.findByText(/reached its site limit/)).toBeVisible();
    for (const action of screen.getAllByRole('button', { name: 'New site' }))
      expect(action).toBeDisabled();
  });
});
