/* eslint-disable @typescript-eslint/require-await -- callbacks model persistence. */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import type { SiteActivityItem } from '@hansel/contracts';
import { SiteActivityFeed } from './SiteActivityFeed.js';

afterEach(cleanup);

const action: SiteActivityItem = {
  id: '00000000-0000-4000-8000-000000000050',
  kind: 'SIGN_CREATED',
  subjectLabel: 'RS.101',
  actor: { displayName: 'Nabin Singh', initials: 'NS' },
  createdAt: '2026-09-05T00:00:00.000Z',
};
const comment: SiteActivityItem = {
  id: '00000000-0000-4000-8000-000000000051',
  kind: 'SITE_COMMENT_ADDED',
  commentText: 'Ready for review.',
  actor: { displayName: 'Nabin Singh', initials: 'NS' },
  createdAt: '2026-09-06T00:00:00.000Z',
};

describe('SiteActivityFeed [site-activity-feed-comments REQ-011..REQ-019, AC-001, AC-003, AC-006]', () => {
  it('renders real actions and comments and reconciles a submitted comment', async () => {
    const submit = vi.fn(async () => ({
      ...comment,
      id: '00000000-0000-4000-8000-000000000052',
      commentText: 'A new comment',
    }));
    render(
      <SiteActivityFeed
        initial={{ items: [comment, action], nextCursor: null }}
        now={new Date('2026-09-06T01:00:00.000Z')}
        loadOlder={vi.fn()}
        submitComment={submit}
      />,
    );
    expect(screen.getByText(/created sign/)).toHaveTextContent('RS.101');
    expect(screen.getByText('Ready for review.')).toBeVisible();
    const field = screen.getByRole('textbox', { name: 'Add your comment' });
    fireEvent.change(field, { target: { value: 'A new comment' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith('A new comment');
    });
    expect(await screen.findByText('A new comment')).toBeVisible();
    expect(field).toHaveValue('');
  });

  it('shows the truthful empty state and preserves a failed comment', async () => {
    const view = render(
      <SiteActivityFeed
        initial={{ items: [], nextCursor: null }}
        loadOlder={vi.fn()}
        submitComment={vi.fn().mockRejectedValue(new Error('offline'))}
      />,
    );
    expect(view.getByText('Site activity will appear here.')).toBeVisible();
    const field = view.getByRole('textbox', { name: 'Add your comment' });
    fireEvent.change(field, { target: { value: 'Keep me' } });
    fireEvent.click(view.getByRole('button', { name: 'Comment' }));
    expect(await view.findByRole('alert')).toBeVisible();
    expect(field).toHaveValue('Keep me');
  });

  it('settles a successful comment under React Strict Mode [site-activity-feed-comments REQ-014, REQ-017]', async () => {
    render(
      <StrictMode>
        <SiteActivityFeed
          initial={{ items: [], nextCursor: null }}
          loadOlder={vi.fn()}
          submitComment={vi.fn().mockResolvedValue(comment)}
        />
      </StrictMode>,
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Ready for review.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    expect(
      await screen.findByRole('button', { name: 'Comment' }),
    ).toBeDisabled();
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByText('Ready for review.')).toBeVisible();
  });
});
