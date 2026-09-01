import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteActivity } from './SiteActivity.js';

afterEach(cleanup);

const viewer = {
  viewer: { displayName: 'Nabin Singh', initials: 'NS', roleLabel: 'Owner' },
};
const siteId = 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9';
const props = {
  loadDashboard: () => Promise.resolve(viewer),
  logout: () => Promise.resolve(),
};

describe('SiteActivity [sites-add-new REQ-019]', () => {
  it('shows loading then the tenant-scoped Activity context', async () => {
    let resolve:
      ((value: { site: { id: string; name: string } }) => void) | undefined;
    render(
      <SiteActivity
        {...props}
        loadActivity={() =>
          new Promise((done) => {
            resolve = done;
          })
        }
      />,
    );
    expect(screen.getByText('Loading site…')).toHaveAttribute('role', 'status');
    resolve?.({ site: { id: siteId, name: 'Sydney Central' } });
    expect(
      await screen.findByRole('heading', { name: 'Sydney Central' }),
    ).toBeVisible();
    expect(
      screen.getByRole('navigation', { name: 'Site sections' }),
    ).toHaveTextContent('Activity');

    const prevent = vi.fn((event: MouseEvent) => {
      event.preventDefault();
    });
    document.addEventListener('click', prevent);
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    document.removeEventListener('click', prevent);
    expect(prevent).toHaveBeenCalledOnce();
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
});
