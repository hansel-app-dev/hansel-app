/* eslint-disable @typescript-eslint/no-base-to-string -- Request bodies are JSON strings in these fetch fixtures. */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import {
  countryOptions,
  industryOptions,
  organizationSizeOptions,
  placeServiceOptions,
  discoveryManagementOptions,
} from '@hansel/contracts';

const planFixture = (
  priceId:
    | 'free'
    | 'plus_monthly'
    | 'plus_annual'
    | 'pro_monthly'
    | 'pro_annual'
    | 'enterprise',
) => {
  const planId =
    priceId === 'free'
      ? 'free'
      : priceId.startsWith('plus')
        ? 'plus'
        : priceId.startsWith('pro')
          ? 'pro'
          : 'enterprise';
  return {
    priceId,
    planId,
    displayName: planId.charAt(0).toUpperCase() + planId.slice(1),
    description: 'Plan',
    features: ['Feature one', 'Feature two', 'Feature three'],
    billingInterval: priceId.endsWith('monthly')
      ? 'monthly'
      : priceId.endsWith('annual')
        ? 'annual'
        : null,
    currency: 'USD',
    amountMinor: priceId === 'enterprise' ? null : 0,
    monthlyEquivalentMinor: priceId === 'enterprise' ? null : 0,
    additionalSiteAmountMinor: null,
    paymentRequired: planId === 'plus' || planId === 'pro',
    maximumSites: planId === 'free' ? 1 : null,
    contactSales: planId === 'enterprise',
  };
};
const planFixtures = (
  [
    'free',
    'plus_monthly',
    'plus_annual',
    'pro_monthly',
    'pro_annual',
    'enterprise',
  ] as const
).map(planFixture);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  window.sessionStorage.clear();
  document.cookie = 'hansel_onboarding_csrf=; Max-Age=0; path=/';
  window.history.replaceState({}, '', '/');
});

describe('App [REQ-002]', () => {
  it('carries the normalized recovery email from request to reset [password-recovery REQ-002, REQ-008]', async () => {
    window.history.replaceState({}, '', '/forgot-password');
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 'accepted' }), { status: 202 }),
      );
    vi.stubGlobal('fetch', fetcher);
    render(<App />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: ' OWNER@Example.com ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset code' }));

    expect(
      await screen.findByRole('heading', { name: 'Reset your password' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Email')).toHaveValue('owner@example.com');
    expect(window.location.pathname).toBe('/reset-password');
    expect(window.sessionStorage.getItem('hansel.passwordRecoveryEmail')).toBe(
      'owner@example.com',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Request a new code' }));
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  it('returns a completed reset to login with a safe success message [password-recovery REQ-010]', async () => {
    window.history.replaceState({}, '', '/reset-password');
    window.sessionStorage.setItem(
      'hansel.passwordRecoveryEmail',
      'owner@example.com',
    );
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ destination: '/login' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetcher);
    render(<App />);

    fireEvent.change(screen.getByLabelText('Reset code'), {
      target: { value: '123456' },
    });
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'Correct horse battery staple!7' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'Correct horse battery staple!7' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Your password has been reset.',
      ),
    );
    expect(window.location.pathname).toBe('/login');
    expect(window.location.search).toBe('?password_reset=success');
    expect(
      window.sessionStorage.getItem('hansel.passwordRecoveryEmail'),
    ).toBeNull();
  });

  it('clears the recovery email when returning to login [password-recovery REQ-018]', () => {
    window.history.replaceState({}, '', '/reset-password');
    window.sessionStorage.setItem(
      'hansel.passwordRecoveryEmail',
      'owner@example.com',
    );
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: 'Back to log in' }));
    expect(window.location.pathname).toBe('/login');
    expect(
      window.sessionStorage.getItem('hansel.passwordRecoveryEmail'),
    ).toBeNull();
  });

  it('routes only /dashboard to the authenticated dashboard module [dashboard-home REQ-006]', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              viewer: {
                displayName: 'Nabin Singh',
                initials: 'NS',
                roleLabel: 'Owner',
              },
            }),
            { status: 200 },
          ),
        ),
      ),
    );

    render(<App path="/dashboard" />);

    expect(await screen.findByText('Nabin Singh')).toBeVisible();
    expect(
      screen.getAllByRole('heading', { name: 'Widget title' }),
    ).toHaveLength(4);
    expect(fetch).toHaveBeenCalledWith('/api/dashboard', {
      credentials: 'include',
    });
  });

  it('routes /sites to the authenticated Figma empty state and navigates through the shared shell [sites-empty-state REQ-001..REQ-004]', async () => {
    const sitesPage = {
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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              url.endsWith('/api/sites')
                ? sitesPage
                : {
                    viewer: {
                      displayName: 'Nabin Singh',
                      initials: 'NS',
                      roleLabel: 'Owner',
                    },
                  },
            ),
            { status: 200 },
          ),
        ),
      ),
    );

    render(<App path="/sites" />);

    expect(
      await screen.findByRole('heading', { name: 'No sites', level: 2 }),
    ).toBeVisible();
    expect(await screen.findByText('Nabin Singh')).toBeVisible();
    const dashboardRequestsBeforeNavigation = vi
      .mocked(fetch)
      .mock.calls.filter(([url]) =>
        String(url).endsWith('/api/dashboard'),
      ).length;
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(
      screen.getAllByRole('heading', { name: 'Widget title' }),
    ).toHaveLength(4);
    expect(window.location.pathname).toBe('/dashboard');
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(([url]) => String(url).endsWith('/api/dashboard')),
    ).toHaveLength(dashboardRequestsBeforeNavigation);
  });

  it('creates a site through the modal and opens its authenticated Activity route [sites-add-new REQ-001..REQ-019]', async () => {
    const siteId = 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9';
    let siteCreated = false;
    const fetcher = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/api/dashboard'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              viewer: {
                displayName: 'Nabin Singh',
                initials: 'NS',
                roleLabel: 'Owner',
              },
            }),
          ),
        );
      if (url.endsWith('/api/sites') && init?.method === 'POST') {
        siteCreated = true;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              siteId,
              destination: `/sites/${siteId}/activity`,
            }),
            { status: 201 },
          ),
        );
      }
      if (url.endsWith('/api/sites'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
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
              sites: siteCreated
                ? [
                    {
                      id: siteId,
                      name: 'New site',
                      createdAt: '2026-09-05T10:00:00.000Z',
                      updatedAt: '2026-09-05T10:00:00.000Z',
                      memberCount: 0,
                      memberPreview: [],
                    },
                  ]
                : [],
            }),
          ),
        );
      if (url.endsWith('/activity'))
        return Promise.resolve(
          new Response(JSON.stringify({ items: [], nextCursor: null })),
        );
      return Promise.resolve(
        new Response(
          JSON.stringify({
            site: { id: siteId, name: 'New site' },
          }),
        ),
      );
    });
    vi.stubGlobal('fetch', fetcher);
    render(<App path="/sites" />);
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: 'New site' })[0],
      ).toBeEnabled(),
    );
    const newSite = screen.getAllByRole('button', { name: 'New site' }).at(0);
    if (!newSite) throw new Error('Expected the New site action');
    fireEvent.click(newSite);
    fireEvent.click(screen.getByRole('button', { name: 'Add new site' }));
    expect(
      await screen.findByRole('heading', { name: 'Add a cover image' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(
      await screen.findByRole('heading', { name: 'New site' }),
    ).toBeVisible();
    expect(window.location.pathname).toBe(`/sites/${siteId}/activity`);
  });

  it('renders direct Activity and returns an expired Activity session to login [sites-add-new REQ-016, REQ-019]', async () => {
    const siteId = 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9';
    const activityPath = `/sites/${siteId}/activity`;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          new Response(
            url.startsWith('https://uploads.example/')
              ? null
              : JSON.stringify(
                  url.endsWith('/api/dashboard')
                    ? {
                        viewer: {
                          displayName: 'Nabin Singh',
                          initials: 'NS',
                          roleLabel: 'Owner',
                        },
                      }
                    : url.endsWith('/api/sites')
                      ? {
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
                          sites: [
                            {
                              id: siteId,
                              name: 'Direct site',
                              createdAt: '2026-09-05T10:00:00.000Z',
                              updatedAt: '2026-09-05T10:00:00.000Z',
                              memberCount: 0,
                              memberPreview: [],
                            },
                          ],
                        }
                      : url.endsWith('/activity')
                        ? { items: [], nextCursor: null }
                        : url.endsWith('/allocation-plans')
                          ? { canAddPlans: true, plans: [] }
                          : url.endsWith('/allocation-plan-upload-batches')
                            ? {
                                uploads: [
                                  {
                                    uploadId:
                                      '00000000-0000-4000-8000-000000000005',
                                    uploadUrl: 'https://uploads.example/plan',
                                    expiresAt: '2026-09-06T00:15:00.000Z',
                                    headers: {
                                      'content-type': 'application/pdf',
                                      'x-amz-checksum-sha256':
                                        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
                                    },
                                  },
                                ],
                              }
                            : url.endsWith('/finalize')
                              ? {
                                  plan: {
                                    id: '00000000-0000-4000-8000-000000000006',
                                    filename: 'plan.pdf',
                                    mediaType: 'application/pdf',
                                    byteSize: 5,
                                    createdAt: '2026-09-06T00:00:00.000Z',
                                    modifiedAt: '2026-09-06T00:00:00.000Z',
                                    uploadedBy: 'Owner',
                                  },
                                }
                              : { site: { id: siteId, name: 'Direct site' } },
                ),
          ),
        ),
      ),
    );
    const view = render(<App path={activityPath} />);
    expect(
      await screen.findByRole('heading', { name: 'Direct site' }),
    ).toBeVisible();
    view.unmount();
    window.history.replaceState({}, '', activityPath);
    let dashboardCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/api/dashboard') && dashboardCalls++ < 1)
          return Promise.resolve(
            new Response(
              JSON.stringify({
                viewer: {
                  displayName: 'Nabin Singh',
                  initials: 'NS',
                  roleLabel: 'Owner',
                },
              }),
            ),
          );
        return Promise.resolve(new Response(null, { status: 401 }));
      }),
    );
    render(<App path={activityPath} />);
    expect(
      await screen.findByRole('heading', { name: 'Log in to your account' }),
    ).toBeVisible();
  });

  it('renders the authorized Allocation Plans empty route [site-allocation-plans-empty-state REQ-001, REQ-002, AC-001]', async () => {
    const siteId = 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9';
    const uploadId = '8ca72d3f-f711-498e-b9af-7759b4a829f5';
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.startsWith('https://uploads.example.com/'))
          return Promise.resolve(new Response(null));
        return Promise.resolve(
          new Response(
            JSON.stringify(
              url.endsWith('/api/dashboard')
                ? {
                    viewer: {
                      displayName: 'Nabin Singh',
                      initials: 'NS',
                      roleLabel: 'Owner',
                    },
                  }
                : url.endsWith('/api/sites')
                  ? {
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
                      sites: [
                        {
                          id: siteId,
                          name: 'Direct site',
                          createdAt: '2026-09-05T10:00:00.000Z',
                          updatedAt: '2026-09-05T10:00:00.000Z',
                          memberCount: 0,
                          memberPreview: [],
                        },
                      ],
                    }
                  : url.endsWith('/allocation-plans')
                    ? { canAddPlans: true, plans: [] }
                    : url.endsWith('/allocation-plan-drafts')
                      ? {
                          uploads: [
                            {
                              uploadId,
                              uploadUrl: `https://uploads.example.com/${uploadId}`,
                              expiresAt: new Date(
                                Date.now() + 900_000,
                              ).toISOString(),
                              headers: {
                                'content-type': 'application/pdf',
                                'x-amz-checksum-sha256':
                                  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
                              },
                            },
                          ],
                        }
                      : url.endsWith('/verify')
                        ? { uploadId, verified: true }
                        : url.endsWith('/commit')
                          ? {
                              plan: {
                                id: 'a87f107e-ac6e-46a7-b46c-11a86dd56c74',
                                filename: 'plan.pdf',
                                mediaType: 'application/pdf',
                                byteSize: 5,
                                createdAt: '2026-09-06T00:00:00.000Z',
                                modifiedAt: '2026-09-06T00:00:00.000Z',
                                uploadedBy: 'Owner',
                              },
                            }
                          : { site: { id: siteId, name: 'Direct site' } },
            ),
          ),
        );
      }),
    );

    const uploadListeners = new Map<string, EventListener>();
    vi.stubGlobal(
      'XMLHttpRequest',
      vi.fn(() => ({
        status: 200,
        upload: { addEventListener: vi.fn() },
        open: vi.fn(),
        setRequestHeader: vi.fn(),
        addEventListener: (name: string, listener: EventListener) => {
          uploadListeners.set(name, listener);
        },
        abort: vi.fn(),
        send: () => {
          queueMicrotask(() =>
            uploadListeners.get('load')?.(new Event('load')),
          );
        },
      })),
    );

    render(<App path={`/sites/${siteId}/allocations`} />);

    expect(
      await screen.findByRole('heading', { name: 'No plans', level: 2 }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Allocations', current: 'page' }),
    ).toHaveAttribute('href', `/sites/${siteId}/allocations`);
    fireEvent.click(screen.getByRole('button', { name: 'Add plan' }));
    fireEvent.change(screen.getByLabelText('Allocation name'), {
      target: { value: 'Ground floor' },
    });
    const file = new File(['%PDF-'], 'plan.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.resolve(new TextEncoder().encode('%PDF-').buffer),
    });
    const picker = document.querySelector('input[type="file"]');
    if (!picker) throw new Error('Expected file picker');
    fireEvent.change(picker, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Add Allocation' }),
      ).toBeEnabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Allocation' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('renders and mutates the persisted Signage Schedule route [site-signage-schedule AC-001..AC-003]', async () => {
    const siteId = 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9';
    const typeId = '00000000-0000-4000-8000-000000000010';
    const signId = '00000000-0000-4000-8000-000000000011';
    const now = '2026-09-06T00:00:00.000Z';
    const sign = {
      id: signId,
      signTypeId: typeId,
      code: 'A.1',
      quantity: 1,
      location: '',
      content: '',
      comments: '',
      createdAt: now,
      updatedAt: now,
    };
    const type = {
      id: typeId,
      name: 'Regulatory',
      color: 'RED',
      createdAt: now,
      updatedAt: now,
      quantityTotal: 1,
      signs: [sign],
    };
    const fetcher = vi.fn((url: string, init?: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.endsWith('/api/dashboard')
              ? {
                  viewer: {
                    displayName: 'Nabin Singh',
                    initials: 'NS',
                    roleLabel: 'Owner',
                  },
                }
              : url.endsWith('/api/sites')
                ? {
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
                    sites: [
                      {
                        id: siteId,
                        name: 'Direct site',
                        createdAt: now,
                        updatedAt: now,
                        memberCount: 0,
                        memberPreview: [],
                      },
                    ],
                  }
                : url.endsWith('/signage-schedule')
                  ? { canManageSigns: true, signTypes: [type] }
                  : url.endsWith('/sign-types')
                    ? {
                        ...type,
                        id: '00000000-0000-4000-8000-000000000020',
                        name: JSON.parse(String(init?.body)).name,
                        signs: [],
                        quantityTotal: 0,
                      }
                    : url.includes('/sign-types/') && init?.method === 'PATCH'
                      ? { ...type, name: JSON.parse(String(init.body)).name }
                      : url.endsWith('/signs')
                        ? {
                            ...sign,
                            id: '00000000-0000-4000-8000-000000000021',
                            code: JSON.parse(String(init?.body)).code,
                          }
                        : url.includes('/signs/')
                          ? {
                              ...sign,
                              [JSON.parse(String(init?.body)).field]:
                                JSON.parse(String(init?.body)).value,
                            }
                          : { site: { id: siteId, name: 'Direct site' } },
          ),
        ),
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    render(<App path={`/sites/${siteId}/signage-schedule`} />);
    expect(
      await screen.findByRole('region', { name: 'Signage Schedule' }),
    ).toBeVisible();
    const location = screen.getByRole('textbox', { name: 'A.1 location' });
    fireEvent.change(location, { target: { value: 'G001' } });
    fireEvent.blur(location);
    const typeName = screen.getByRole('textbox', { name: 'Regulatory name' });
    fireEvent.change(typeName, { target: { value: 'Safety' } });
    fireEvent.blur(typeName);
    fireEvent.click(screen.getByRole('button', { name: /Add sign/ }));
    const code = screen.getByRole('textbox', { name: /New sign code/ });
    fireEvent.change(code, { target: { value: 'A.2' } });
    fireEvent.blur(code);
    fireEvent.click(screen.getByRole('button', { name: /New sign type/ }));
    const draft = screen.getByRole('textbox', { name: 'New sign type name' });
    fireEvent.change(draft, { target: { value: 'Wayfinding' } });
    fireEvent.blur(draft);
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        expect.stringContaining(`/signs/${signId}`),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('allocation-plan-single-file REQ-003..005: switches plan routes and restores history selection', async () => {
    const siteId = 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9';
    const planId = 'a87f107e-ac6e-46a7-b46c-11a86dd56c74';
    const otherPlanId = 'a87f107e-ac6e-46a7-b46c-11a86dd56c75';
    Object.assign(URL, {
      createObjectURL: vi.fn().mockReturnValue('blob:plan'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/content'))
          return Promise.resolve(
            new Response('png', {
              headers: { 'content-type': 'image/png' },
            }),
          );
        const value = url.endsWith('/api/dashboard')
          ? {
              viewer: {
                displayName: 'Nabin Singh',
                initials: 'NS',
                roleLabel: 'Owner',
              },
            }
          : url.endsWith('/api/sites')
            ? {
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
                sites: [
                  {
                    id: siteId,
                    name: 'Direct site',
                    createdAt: '2026-09-05T10:00:00.000Z',
                    updatedAt: '2026-09-05T10:00:00.000Z',
                    memberCount: 0,
                    memberPreview: [],
                  },
                ],
              }
            : url.endsWith('/allocation-plans')
              ? {
                  canAddPlans: true,
                  plans: [planId, otherPlanId].map((id, index) => ({
                    id,
                    name: index === 0 ? 'Ground' : 'First',
                    filename:
                      index === 0 ? 'Ground Floor.png' : 'First Floor.png',
                    mediaType: 'image/png',
                    byteSize: 3,
                    createdAt: '2026-09-06T00:00:00.000Z',
                    modifiedAt: '2026-09-06T00:00:00.000Z',
                    uploadedBy: 'Owner',
                  })),
                }
              : { site: { id: siteId, name: 'Direct site' } };
        return Promise.resolve(new Response(JSON.stringify(value)));
      }),
    );
    render(<App path={`/sites/${siteId}/allocations/${planId}`} />);
    expect(
      await screen.findByRole('img', { name: 'Ground Floor.png' }),
    ).toHaveAttribute('src', 'blob:plan');
    fireEvent.click(
      screen.getByRole('button', { name: 'Select allocation plan' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: /First/ }));
    await screen.findByRole('img', { name: 'First Floor.png' });
    expect(window.location.pathname).toBe(
      `/sites/${siteId}/allocations/${otherPlanId}`,
    );
    act(() => {
      window.history.replaceState(
        {},
        '',
        `/sites/${siteId}/allocations/${planId}`,
      );
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await screen.findByRole('img', { name: 'Ground Floor.png' });
  });

  it.each(['/sites/allocations', '/sites/not-a-site/allocations'])(
    'rejects the malformed Allocation Plans route %s through the generic Site boundary [site-allocation-plans-empty-state REQ-001, AC-003]',
    async (path) => {
      const fetcher = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            viewer: {
              displayName: 'Nabin Singh',
              initials: 'NS',
              roleLabel: 'Owner',
            },
          }),
        ),
      );
      vi.stubGlobal('fetch', fetcher);

      render(<App path={path} />);

      expect(
        await screen.findByText("We couldn't load this site."),
      ).toBeVisible();
      expect(screen.queryByText('Hansel')).not.toBeInTheDocument();
      expect(fetcher).toHaveBeenCalledOnce();
      expect(fetcher).toHaveBeenCalledWith(
        '/api/dashboard',
        expect.any(Object),
      );
    },
  );

  it('returns an unauthenticated Sites page to login [sites-empty-state REQ-002]', async () => {
    window.history.replaceState({}, '', '/sites');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Log in to your account' }),
    ).toBeVisible();
    expect(window.location.pathname).toBe('/login');
  });

  it('returns an unauthenticated dashboard to login [user-login REQ-012]', async () => {
    window.history.replaceState({}, '', '/dashboard');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Log in to your account' }),
    ).toBeVisible();
    expect(window.location.pathname).toBe('/login');
  });

  it('logs out from the dashboard and replaces navigation with login [user-login REQ-012]', async () => {
    window.history.replaceState({}, '', '/dashboard');
    window.sessionStorage.setItem(
      'hansel.verificationEmail',
      'stale@example.com',
    );
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            viewer: {
              displayName: 'Nabin Singh',
              initials: 'NS',
              roleLabel: 'Owner',
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);

    render(<App />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Nabin Singh, Owner' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(
      await screen.findByRole('heading', { name: 'Log in to your account' }),
    ).toBeVisible();
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/dashboard/logout', {
      method: 'POST',
      credentials: 'include',
    });
    expect(window.location.pathname).toBe('/login');
    expect(
      window.sessionStorage.getItem('hansel.verificationEmail'),
    ).toBeNull();
  });

  it('routes a successful login to the server-owned destination [user-login REQ-009, REQ-012]', async () => {
    window.history.replaceState({}, '', '/login');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ destination: '/dashboard' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            viewer: {
              displayName: 'Nabin Singh',
              initials: 'NS',
              roleLabel: 'Owner',
            },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetcher);

    render(<App />);
    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: ' Nabin@Example.com ' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correct-password-1!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Nabin Singh')).toBeVisible();
    expect(window.location.pathname).toBe('/dashboard');
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/auth/login', {
      body: expect.any(String),
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const submittedBody = fetcher.mock.calls[1]?.[1]?.body;
    if (typeof submittedBody !== 'string')
      throw new Error('Expected a serialized login request');
    const submittedLogin: unknown = JSON.parse(submittedBody);
    expect(submittedLogin).toEqual({
      email: 'nabin@example.com',
      password: 'Correct-password-1!',
    });
  });

  it('stores the normalized email when login resumes verification [user-login REQ-009]', async () => {
    window.history.replaceState({}, '', '/login');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ destination: '/onboarding/verify-email' }),
            { status: 200 },
          ),
        ),
    );
    render(<App />);
    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: ' Owner@Example.com ' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correct-password-1!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(
      await screen.findByRole('heading', { name: 'Verify your account' }),
    ).toBeVisible();
    expect(window.sessionStorage.getItem('hansel.verificationEmail')).toBe(
      'owner@example.com',
    );
  });

  it('replaces login with dashboard for an existing valid session [user-login REQ-012]', async () => {
    window.history.replaceState({}, '', '/login');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              viewer: {
                displayName: 'Nabin Singh',
                initials: 'NS',
                roleLabel: 'Owner',
              },
            }),
            { status: 200 },
          ),
        ),
      ),
    );

    render(<App />);

    expect(await screen.findByText('Nabin Singh')).toBeVisible();
    expect(window.location.pathname).toBe('/dashboard');
  });

  it('ignores a completed login preflight after the page unmounts', () => {
    window.history.replaceState({}, '', '/login');
    let resolveFetch: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    const view = render(<App />);
    view.unmount();
    act(() => {
      resolveFetch?.(
        new Response(
          JSON.stringify({
            viewer: { displayName: 'Ava', initials: 'A', roleLabel: 'Owner' },
          }),
          { status: 200 },
        ),
      );
    });
    expect(window.location.pathname).toBe('/login');
  });

  it('renders discovery and follows only the server-owned dashboard destination [onboarding-discovery REQ-001, REQ-010]', async () => {
    document.cookie = 'hansel_onboarding_csrf=proof; path=/';
    const openExternal = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              submissionKey: 'x'.repeat(43),
              methods: discoveryManagementOptions,
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              nextStep: 'dashboard',
              destination: '/dashboard',
            }),
            { status: 200 },
          ),
        ),
    );
    render(<App path="/onboarding/discovery" openExternal={openExternal} />);
    fireEvent.change(
      await screen.findByLabelText('How do you manage your signage currently?'),
      { target: { value: 'pdf' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(openExternal).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('returns from discovery to the saved organization profile [onboarding-discovery REQ-012]', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              submissionKey: 'x'.repeat(43),
              methods: discoveryManagementOptions,
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              submissionKey: 'o'.repeat(43),
              countries: countryOptions,
              industries: industryOptions,
              placesByIndustry: placeServiceOptions,
              sizes: organizationSizeOptions,
            }),
            { status: 200 },
          ),
        ),
    );
    window.history.replaceState({}, '', '/onboarding/discovery');
    render(<App />);
    await screen.findByLabelText('How do you manage your signage currently?');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(window.location.pathname).toBe('/onboarding/organization-profile');
  });

  it('returns an expired discovery session to onboarding [onboarding-discovery REQ-013]', async () => {
    window.history.replaceState({}, '', '/onboarding/discovery');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'onboarding_session_expired' }), {
          status: 401,
        }),
      ),
    );
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: "Let's get started" }),
    ).toBeVisible();
    expect(window.location.pathname).toBe('/onboarding');
    window.history.replaceState({}, '', '/');
  });
  it('routes organization profile completion to discovery [onboarding-organization-profile REQ-001, REQ-011]', async () => {
    document.cookie = 'hansel_onboarding_csrf=proof; path=/';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              submissionKey: 'x'.repeat(43),
              countries: countryOptions,
              industries: [...industryOptions],
              placesByIndustry: Object.fromEntries(
                Object.entries(placeServiceOptions).map(([key, values]) => [
                  key,
                  [...values],
                ]),
              ),
              sizes: [...organizationSizeOptions],
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ nextStep: 'discovery' }), {
            status: 200,
          }),
        ),
    );
    render(<App path="/onboarding/organization-profile" />);
    await screen.findByLabelText('Organization');
    fireEvent.change(screen.getByLabelText('Organization'), {
      target: { value: 'Hansel' },
    });
    fireEvent.change(screen.getByLabelText('Country'), {
      target: { value: 'AU' },
    });
    fireEvent.change(screen.getByLabelText('Industry or sector'), {
      target: { value: 'healthcare' },
    });
    fireEvent.change(screen.getByLabelText('Type of place or service'), {
      target: { value: 'clinics' },
    });
    fireEvent.change(screen.getByLabelText('Size'), {
      target: { value: 'employees_11_50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/onboarding/discovery');
    });
  });
  it('shows only Hansel in the middle of the landing page [REQ-006]', () => {
    render(<App />);
    const main = screen.getByRole('main');
    expect(main).toHaveClass('place-items-center');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Hansel',
    );
    expect(main).toHaveTextContent(/^Hansel$/);
  });

  it('routes the approved onboarding entry to the account form', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<App path="/onboarding" />);
    expect(
      screen.getByRole('heading', { name: "Let's get started" }),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['onboarding', '/onboarding', "Let's get started"],
    ['verification', '/onboarding/verify-email', 'Verify your account'],
  ])(
    'keeps an unavailable hinted session at the %s entry [REQ-089]',
    async (_entry, path, heading) => {
      document.cookie = 'hansel_onboarding_csrf=proof; path=/';
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'onboarding_session_expired' }), {
          status: 401,
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      render(<App path={path} />);

      expect(
        screen.getByRole('heading', { name: heading }),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledOnce();
      });
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/onboarding/personal-profile',
        expect.objectContaining({ method: 'GET', credentials: 'include' }),
      );
    },
  );

  it.each([
    ['onboarding', '/onboarding'],
    ['verification', '/onboarding/verify-email'],
  ])(
    'resumes an active session at About You from %s [REQ-089]',
    async (_entry, path) => {
      document.cookie = 'hansel_onboarding_csrf=proof; path=/';
      window.sessionStorage.setItem(
        'hansel.verificationEmail',
        'owner@example.com',
      );
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockImplementation(() =>
            Promise.resolve(
              new Response(JSON.stringify({ profile: null }), { status: 200 }),
            ),
          ),
      );

      render(<App apiUrl="https://api.example" path={path} />);

      expect(
        await screen.findByRole('heading', { name: 'Tell us about you' }),
      ).toBeInTheDocument();
      expect(window.location.pathname).toBe('/onboarding/about-you');
      expect(
        window.sessionStorage.getItem('hansel.verificationEmail'),
      ).toBeNull();
      window.history.replaceState({}, '', '/');
    },
  );

  it('does not resume after the session-aware page is closed [REQ-089]', async () => {
    document.cookie = 'hansel_onboarding_csrf=proof; path=/';
    window.history.replaceState({}, '', '/onboarding');
    let resolveProbe: (response: Response) => void = () => undefined;
    const pendingProbe = new Promise<Response>((resolve) => {
      resolveProbe = resolve;
    });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pendingProbe));

    const view = render(<App path="/onboarding" />);
    view.unmount();
    await act(async () => {
      resolveProbe(
        new Response(JSON.stringify({ profile: null }), { status: 200 }),
      );
      await pendingProbe;
    });

    expect(window.location.pathname).toBe('/onboarding');
    window.history.replaceState({}, '', '/');
  });

  it('routes the personal profile step', () => {
    render(<App path="/onboarding/about-you" />);
    expect(
      screen.getByRole('heading', { name: 'Tell us about you' }),
    ).toBeInTheDocument();
  });

  it('restores the accepted personal profile when returning to the step [REQ-011, REQ-014]', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          profile: {
            firstName: 'Nabin',
            lastName: 'Singh',
            jobTitle: 'manager',
            department: 'marketing_communications',
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<App apiUrl="https://api.example" path="/onboarding/about-you" />);

    await waitFor(() => {
      expect(screen.getByLabelText('First name')).toHaveValue('Nabin');
    });
    expect(screen.getByLabelText('Last name')).toHaveValue('Singh');
    expect(screen.getByLabelText('Job title')).toHaveValue('manager');
    expect(screen.getByLabelText('Department')).toHaveValue(
      'marketing_communications',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/api/onboarding/personal-profile',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('logs out an expired personal-profile session and returns to onboarding [REQ-014, REQ-086]', async () => {
    window.history.replaceState({}, '', '/onboarding/about-you');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'onboarding_session_expired' }), {
          status: 401,
        }),
      ),
    );

    render(<App apiUrl="https://api.example" />);

    expect(
      await screen.findByRole('heading', { name: "Let's get started" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/onboarding');
    expect(
      screen.queryByText('Your onboarding session is unavailable.'),
    ).not.toBeInTheDocument();
    window.history.replaceState({}, '', '/');
  });

  it('returns to onboarding when the personal-profile session expires before submission [REQ-086]', async () => {
    window.history.replaceState({}, '', '/onboarding/about-you');
    document.cookie = 'hansel_onboarding_csrf=csrf-proof; path=/';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ profile: null }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ error: 'onboarding_session_expired' }),
            { status: 401 },
          ),
        ),
    );

    render(<App apiUrl="https://api.example" />);
    for (const [label, value] of [
      ['First name', 'Nabin'],
      ['Last name', 'Singh'],
      ['Job title', 'manager'],
      ['Department', 'marketing_communications'],
    ] as const)
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      await screen.findByRole('heading', { name: "Let's get started" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/onboarding');
    window.history.replaceState({}, '', '/');
  });

  it('connects verification and resend actions to the configured API', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ nextStep: 'personal-profile' }), {
            status: 200,
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ profile: null }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status: 'accepted' }), { status: 202 }),
        ),
    );
    render(
      <App apiUrl="https://api.example" path="/onboarding/verify-email" />,
    );
    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
    expect(
      await screen.findByRole('heading', { name: 'Tell us about you' }),
    ).toBeInTheDocument();
    cleanup();
    render(
      <App apiUrl="https://api.example" path="/onboarding/verify-email" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Request new code' }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });

  it('submits personal details and advances to plan selection', async () => {
    window.history.replaceState({}, '', '/onboarding/about-you');
    document.cookie = 'hansel_onboarding_csrf=csrf-proof; path=/';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ profile: null }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nextStep: 'plan-selection' }), {
          status: 200,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<App apiUrl="https://api.example" />);
    for (const [label, value] of [
      ['First name', 'Nabin'],
      ['Last name', 'Singh'],
      ['Job title', 'manager'],
      ['Department', 'marketing_communications'],
    ] as const)
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/onboarding/plan-selection');
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/api/onboarding/personal-profile',
      expect.objectContaining({ credentials: 'include' }),
    );
    window.history.replaceState({}, '', '/');
  });

  it.each([
    ['plus_annual', 'payment', '/onboarding/payment'],
    ['free', 'organization-profile', '/onboarding/organization-profile'],
  ] as const)(
    'routes a selected %s plan to %s [onboarding-plan-selection REQ-006, REQ-007]',
    async (priceId, nextStep, destination) => {
      window.history.replaceState({}, '', '/onboarding/plan-selection');
      document.cookie = 'hansel_onboarding_csrf=csrf-proof; path=/';
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              firstName: 'Nabin',
              selectedInterval: 'annual',
              selectedPriceId: null,
              plans: planFixtures,
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ nextStep }), { status: 200 }),
        );
      vi.stubGlobal('fetch', fetchMock);
      render(<App />);
      fireEvent.click(
        await screen.findByRole('button', {
          name: priceId === 'free' ? 'Or try it for free' : 'Choose Plus',
        }),
      );
      await waitFor(() => {
        expect(window.location.pathname).toBe(destination);
      });
      window.history.replaceState({}, '', '/');
    },
  );

  it('returns from plan selection and restores the accepted profile [REQ-011, REQ-014]', async () => {
    window.history.replaceState({}, '', '/onboarding/plan-selection');
    const profile = {
      firstName: 'Nabin',
      lastName: 'Singh',
      jobTitle: 'manager',
      department: 'marketing_communications',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            firstName: 'Nabin',
            selectedInterval: 'annual',
            selectedPriceId: null,
            plans: planFixtures,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ profile }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<App apiUrl="https://api.example" />);

    fireEvent.click(await screen.findByRole('link', { name: 'Back' }));

    expect(
      await screen.findByRole('heading', { name: 'Tell us about you' }),
    ).toBeVisible();
    await waitFor(() => {
      expect(screen.getByLabelText('First name')).toHaveValue('Nabin');
    });
    expect(window.location.pathname).toBe('/onboarding/about-you');
    window.history.replaceState({}, '', '/');
  });

  it('opens the configured Enterprise sales destination [onboarding-plan-selection REQ-008]', async () => {
    document.cookie = 'hansel_onboarding_csrf=csrf-proof; path=/';
    const openExternal = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              firstName: 'Nabin',
              selectedInterval: 'annual',
              selectedPriceId: null,
              plans: planFixtures,
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              nextStep: 'contact-sales',
              destination: 'https://sales.example.com/hansel',
            }),
            { status: 200 },
          ),
        ),
    );
    render(
      <App path="/onboarding/plan-selection" openExternal={openExternal} />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Schedule a call' }),
    );
    await waitFor(() => {
      expect(openExternal).toHaveBeenCalledWith(
        'https://sales.example.com/hansel',
      );
    });
  });

  it('submits onboarding through the configured API URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ nextStep: 'verify-email' }), {
          status: 202,
        }),
      ),
    );
    render(<App apiUrl="https://api.example" path="/onboarding" />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correct horse battery staple!7' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create with email' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce();
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.example/api/onboarding/accounts',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('carries the submitted destination into the verification step', async () => {
    window.history.replaceState({}, '', '/onboarding');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ nextStep: 'verify-email' }), {
          status: 202,
        }),
      ),
    );
    render(<App />);
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correct horse battery staple!7' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create with email' }));
    expect(
      await screen.findByRole('heading', { name: 'Verify your account' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Request new code in 60s')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('hansel.verificationEmail')).toBe(
      'owner@example.com',
    );
    window.history.replaceState({}, '', '/');
  });

  it('routes an existing account to login without retaining a verification destination [REQ-088]', async () => {
    window.history.replaceState({}, '', '/onboarding');
    window.sessionStorage.setItem(
      'hansel.verificationEmail',
      'stale@example.com',
    );
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ nextStep: 'login' }), { status: 202 }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 401 })),
    );
    render(<App />);
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correct horse battery staple!7' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create with email' }));

    expect(
      await screen.findByRole('heading', { name: 'Log in to your account' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(
      window.sessionStorage.getItem('hansel.verificationEmail'),
    ).toBeNull();
  });

  it('resends to the stored destination after a same-tab reload [REQ-084]', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(
      'hansel.verificationEmail',
      'owner@example.com',
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 'accepted' }), { status: 202 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <App apiUrl="https://api.example" path="/onboarding/verify-email" />,
    );
    for (let second = 0; second < 60; second += 1) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Request new code' }));
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example/api/onboarding/email-verification/resend',
        expect.objectContaining({
          body: JSON.stringify({ email: 'owner@example.com' }),
        }),
      );
    });
  });
});
