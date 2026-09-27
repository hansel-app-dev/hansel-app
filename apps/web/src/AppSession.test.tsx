import type * as apiModule from './api.js';
import type { DashboardResponse } from '@hansel/contracts';
import type { ComponentProps } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from './App.js';
import type { Sites } from './sites/Sites.js';
import type { SiteActivity } from './sites/SiteActivity.js';
import {
  DashboardAuthenticationRequiredError,
  SiteActivityDisabledError,
  SiteActivityNotFoundError,
  loadDashboard,
  logoutDashboard,
  loadSiteActivityPage,
  loadSiteCoverImage,
  createSiteComment,
} from './api.js';
const captured = vi.hoisted(() => ({
  sites: null as ComponentProps<typeof Sites> | null,
  activity: null as ComponentProps<typeof SiteActivity> | null,
}));
vi.mock('./sites/Sites.js', () => ({
  Sites: (props: ComponentProps<typeof Sites>) => {
    captured.sites = props;
    return null;
  },
}));
vi.mock('./sites/SiteActivity.js', () => ({
  SiteActivity: (props: ComponentProps<typeof SiteActivity>) => {
    captured.activity = props;
    return null;
  },
  SiteAllocationPlans: () => null,
  SiteSignageSchedule: () => null,
}));
vi.mock('./api.js', async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  loadDashboard: vi.fn(),
  logoutDashboard: vi.fn(),
  loadSiteActivityPage: vi.fn(),
  loadSiteCoverImage: vi.fn(),
  createSiteComment: vi.fn(),
}));
vi.mock('./sites/upload-cover-image.js', () => ({
  uploadSiteCoverImage: vi.fn().mockRejectedValue(new Error('offline')),
}));
vi.mock('./auth/ExternalProviderActions.js', () => ({
  ExternalProviderActions: () => null,
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  captured.sites = null;
  captured.activity = null;
  window.history.replaceState({}, '', '/');
  window.sessionStorage.clear();
});
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing routed page');
  return value;
}
it('shares pending viewer loads, clears account state on logout and redirects expired cover requests', async () => {
  window.history.replaceState({}, '', '/sites');
  render(<App />);
  const props = required(captured.sites);
  let finish: (value: DashboardResponse) => void = () => undefined;
  vi.mocked(loadDashboard).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const first = props.loadDashboard(),
    second = props.loadDashboard();
  expect(loadDashboard).toHaveBeenCalledOnce();
  await expect(
    required(props.uploadCoverImage)(
      'site',
      new File(['png'], 'cover.png', { type: 'image/png' }),
    ),
  ).rejects.toThrow('offline');
  await act(() => {
    finish({
      viewer: { displayName: 'Owner', initials: 'O', roleLabel: 'Owner' },
    });
    return Promise.all([first, second]);
  });
  window.sessionStorage.setItem(
    'hansel.verificationEmail',
    'owner@example.com',
  );
  vi.mocked(logoutDashboard).mockResolvedValue(undefined);
  await act(() => props.logout());
  expect(window.location.pathname).toBe('/login');
  expect(window.sessionStorage.getItem('hansel.verificationEmail')).toBeNull();
  cleanup();
  window.history.replaceState({}, '', '/sites');
  render(<App />);
  const current = required(captured.sites);
  vi.mocked(loadSiteCoverImage).mockRejectedValueOnce(new Error('offline'));
  await expect(
    required(current.loadCoverImage)('site', new AbortController().signal),
  ).rejects.toThrow('offline');
  vi.mocked(loadSiteCoverImage).mockRejectedValueOnce(
    new DashboardAuthenticationRequiredError(),
  );
  await act(() =>
    expect(
      required(current.loadCoverImage)('site', new AbortController().signal),
    ).rejects.toThrow(),
  );
  expect(window.location.pathname).toBe('/login');
});
it('maps disabled activity pages to absence and preserves unavailable and missing-site failures', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  window.history.replaceState({}, '', `/sites/${id}/activity`);
  render(<App />);
  const props = required(captured.activity);
  vi.mocked(loadSiteActivityPage).mockRejectedValueOnce(
    new SiteActivityDisabledError(),
  );
  await expect(required(props.loadSiteActivityPage)(null)).resolves.toBeNull();
  vi.mocked(loadSiteActivityPage).mockRejectedValueOnce(new Error('offline'));
  await expect(required(props.loadSiteActivityPage)(null)).rejects.toThrow(
    'offline',
  );
  expect(
    required(props.isSiteActivityNotFound)(new SiteActivityNotFoundError()),
  ).toBe(true);
  expect(required(props.isSiteActivityNotFound)(new Error())).toBe(false);
  vi.mocked(createSiteComment).mockRejectedValueOnce(new Error('offline'));
  await expect(required(props.createSiteComment)('Comment')).rejects.toThrow(
    'offline',
  );
  vi.mocked(loadDashboard).mockRejectedValue(new Error('offline'));
  await expect(props.loadDashboard()).rejects.toThrow('offline');
});

it('redirects expired dashboard loads and routes the Microsoft email step', async () => {
  window.history.replaceState({}, '', '/sites');
  render(<App />);
  vi.mocked(loadDashboard).mockRejectedValue(
    new DashboardAuthenticationRequiredError(),
  );
  await act(() =>
    expect(required(captured.sites).loadDashboard()).rejects.toThrow(),
  );
  expect(window.location.pathname).toBe('/login');
  cleanup();
  window.history.replaceState({}, '', '/onboarding/microsoft-email');
  render(<App />);
  expect(document.body).toHaveTextContent('email');
});
