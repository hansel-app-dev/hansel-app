import type { ComponentProps } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  SiteActivity,
  SiteAllocationPlans,
  AllocationPlanCollection,
} from './SiteActivity.js';
import type { SiteActivityFeed } from './SiteActivityFeed.js';
import type { AllocationPlanViewer } from './AllocationPlanViewer.js';
const captured = vi.hoisted(() => ({
  feed: null as ComponentProps<typeof SiteActivityFeed> | null,
  viewer: null as ComponentProps<typeof AllocationPlanViewer> | null,
}));
vi.mock('./SiteActivityFeed.js', () => ({
  SiteActivityFeed: (props: ComponentProps<typeof SiteActivityFeed>) => {
    captured.feed = props;
    return <p>Activity transport</p>;
  },
}));
vi.mock('./AllocationPlanViewer.js', () => ({
  AllocationPlanViewer: (
    props: ComponentProps<typeof AllocationPlanViewer>,
  ) => {
    captured.viewer = props;
    return <p>Drawing transport</p>;
  },
}));
const id = '00000000-0000-4000-8000-000000000001',
  dashboard = {
    viewer: { displayName: 'Owner', initials: 'O', roleLabel: 'Owner' },
  },
  site = {
    id,
    name: 'Site',
    createdAt: '2026-09-27T00:00:00Z',
    updatedAt: '2026-09-27T00:00:00Z',
    memberCount: 0,
    memberPreview: [],
  };
const props = {
  loadDashboard: () => Promise.resolve(dashboard),
  loadSite: () => Promise.resolve({ site }),
  loadActivity: () => Promise.resolve({ site }),
  loadSites: () =>
    Promise.resolve({
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
      sites: [site],
    }),
  logout: () => Promise.resolve(),
};
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing child');
  return value;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  captured.feed = null;
  captured.viewer = null;
});
it('reports optional activity transport failures and treats only matching failures as revoked access', async () => {
  const page = vi.fn().mockResolvedValue({ items: [], nextCursor: id });
  const view = render(<SiteActivity {...props} loadSiteActivityPage={page} />);
  await screen.findByText('Activity transport');
  await required(captured.feed).loadOlder(id);
  expect(page).toHaveBeenCalledWith(id);
  page.mockResolvedValueOnce(null);
  await expect(required(captured.feed).loadOlder(id)).rejects.toThrow(
    'unavailable',
  );
  await expect(
    required(captured.feed).submitComment('Comment'),
  ).rejects.toThrow('unavailable');
  expect(required(captured.feed).onUnavailable?.(new Error('offline'))).toBe(
    false,
  );
  view.rerender(
    <SiteActivity
      {...props}
      loadSiteActivityPage={() => Promise.resolve(null)}
    />,
  );
  await screen.findByText('Site activity will appear here.');
  view.rerender(<SiteActivity {...props} />);
  await waitFor(() => {
    expect(captured.feed).not.toBeNull();
  });
  await expect(required(captured.feed).loadOlder(id)).rejects.toThrow(
    'unavailable',
  );
  const missing = new Error('missing'),
    isMissing = (error: unknown) => error === missing;
  view.rerender(<SiteActivity {...props} isSiteActivityNotFound={isMissing} />);
  expect(required(captured.feed).onUnavailable?.(new Error('offline'))).toBe(
    false,
  );
  act(() => {
    expect(required(captured.feed).onUnavailable?.(missing)).toBe(true);
  });
  await screen.findByRole('alert');
});
it('retries failed site reads within a preloaded shell and delegates native plan navigation', async () => {
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ site });
  const view = render(
    <SiteActivity
      {...props}
      preloadedDashboard={dashboard}
      loadActivity={load}
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  await screen.findByText('Activity transport');
  expect(load).toHaveBeenCalledTimes(2);
  view.unmount();
  const plan = {
    id,
    name: 'Drawing',
    files: [
      {
        id,
        filename: 'plan.png',
        mediaType: 'image/png' as const,
        byteSize: 1,
      },
    ],
    createdAt: '2026-09-27T00:00:00Z',
    modifiedAt: '2026-09-27T00:00:00Z',
    uploadedBy: 'Owner',
  };
  render(
    <SiteAllocationPlans
      {...props}
      previewPlanId={id}
      loadAllocationPlans={() =>
        Promise.resolve({ plans: [plan], canAddPlans: false })
      }
      loadAllocationPlanContent={() => Promise.resolve(new Blob())}
    />,
  );
  await screen.findByText('Drawing transport');
  const assign = vi.fn(),
    original = window;
  vi.stubGlobal(
    'window',
    new Proxy(original, {
      get(target, key): unknown {
        if (key === 'location') return { assign };
        const value: unknown = Reflect.get(target, key);
        return value;
      },
    }),
  );
  required(captured.viewer).onSelectPlan?.('other');
  expect(assign).toHaveBeenCalledWith(`/sites/${id}/allocations/other`);
  vi.unstubAllGlobals();
});

it('searches incomplete legacy metadata safely and displays a legacy filename in the drawing breadcrumb', async () => {
  const plan = {
    id,
    createdAt: '2026-09-27T00:00:00Z',
    modifiedAt: '2026-09-27T00:00:00Z',
    uploadedBy: 'Owner',
  };
  const view = render(<AllocationPlanCollection plans={[plan]} siteId={id} />);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search plans' }), {
    target: { value: 'absent' },
  });
  expect(screen.getByText('No plans match your search.')).toBeVisible();
  view.unmount();
  render(
    <SiteAllocationPlans
      {...props}
      previewPlanId={id}
      loadAllocationPlans={() =>
        Promise.resolve({
          canAddPlans: false,
          plans: [
            {
              ...plan,
              filename: 'Legacy.png',
              mediaType: 'image/png',
              byteSize: 1,
            },
          ],
        })
      }
      loadAllocationPlanContent={() => Promise.resolve(new Blob())}
    />,
  );
  await screen.findByText('Drawing transport');
  expect(
    screen.getByRole('navigation', { name: 'Site breadcrumb' }),
  ).toHaveTextContent('Legacy.png');
});
