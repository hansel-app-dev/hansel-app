import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { relativeTime, SiteCollection } from './SiteCollection.js';

afterEach(cleanup);

const now = new Date('2026-09-05T12:00:00.000Z');
const site = {
  id: 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9',
  name: 'Building A – General Teaching Space',
  createdAt: '2026-06-05T12:00:00.000Z',
  updatedAt: '2026-09-04T12:00:00.000Z',
  memberCount: 5,
  memberPreview: [
    { displayName: 'John Doe', initials: 'JD' },
    { displayName: 'Alex Smith', initials: 'AS' },
    { displayName: 'Mary King', initials: 'MK' },
  ],
};

describe('Site collection [sites-populated-state REQ-009..REQ-015, REQ-020..REQ-025]', () => {
  it.each([
    ['2026-09-05T12:00:00.000Z', 'just now'],
    ['2026-09-05T12:00:30.000Z', 'just now'],
    ['2026-09-05T11:59:00.000Z', '1 minute ago'],
    ['2026-09-05T11:00:00.000Z', '1 hour ago'],
    ['2026-09-03T12:00:00.000Z', '2 days ago'],
    ['2026-07-05T12:00:00.000Z', '2 months ago'],
    ['2024-09-05T12:00:00.000Z', '2 years ago'],
  ])('formats %s as %s', (instant, expected) => {
    expect(relativeTime(instant, now)).toBe(expected);
  });

  it('renders truthful grid metadata and a bounded accessible member preview', () => {
    const newSite = {
      ...site,
      id: 'c1745b68-2885-45dd-9f05-7a35f9466c1c',
      name: 'New site',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      memberCount: 0,
      memberPreview: [],
    };
    render(<SiteCollection now={now} sites={[site, newSite]} />);

    expect(screen.getByText('Edited 1 day ago')).toBeVisible();
    expect(screen.getByText('Created just now')).toBeVisible();
    expect(
      screen.getByRole('group', {
        name: /Members: John Doe, Alex Smith, Mary King; 2 more/,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('group', { name: 'No direct members' }),
    ).toBeVisible();
    expect(screen.getByText('+2')).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses the same Activity destination in list mode and preserves native or client navigation', () => {
    const navigate = vi.fn();
    const { rerender } = render(
      <SiteCollection navigate={navigate} now={now} sites={[site]} />,
    );
    fireEvent.click(screen.getByRole('link', { name: site.name }));
    expect(navigate).toHaveBeenCalledWith(`/sites/${site.id}/activity`);

    rerender(<SiteCollection now={now} sites={[site]} />);
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    const table = screen.getByRole('table', { name: 'Sites list' });
    const link = within(table).getByRole('link', { name: site.name });
    expect(link).toHaveAttribute('href', `/sites/${site.id}/activity`);
  });

  it('reserves the decorative overflow area without exposing an action or opening the site', () => {
    const navigate = vi.fn();
    const { container } = render(
      <SiteCollection navigate={navigate} now={now} sites={[site]} />,
    );
    const reserve = container.querySelector('[data-site-overflow-reserve]');
    if (!reserve) throw new Error('Expected the decorative overflow reserve');

    fireEvent.click(reserve);
    expect(navigate).not.toHaveBeenCalled();
    expect(reserve).toHaveAttribute('aria-hidden', 'true');
    expect(reserve).not.toHaveAttribute('role');
  });
});
