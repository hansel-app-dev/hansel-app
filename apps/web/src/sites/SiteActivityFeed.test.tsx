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
    expect(screen.getByText('Ready for review.').parentElement).toHaveAttribute(
      'data-activity-comment-card',
    );
    expect(screen.getByRole('textbox')).toHaveClass('min-h-[52px]');
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

it('renders every activity kind and paginates without duplicate items, with retry and keyboard comments', async () => {
  const kinds = [
    'SITE_CREATED',
    'ALLOCATION_PLAN_ADDED',
    'SIGN_TYPE_CREATED',
    'SIGN_TYPE_RENAMED',
    'SIGN_UPDATED',
  ] as const;
  const items = kinds.map((kind, index) => ({
    ...action,
    id: String(index),
    kind,
    subjectLabel: 'Subject',
  }));
  const older = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ items: [action, comment], nextCursor: null });
  render(
    <SiteActivityFeed
      viewer={{ displayName: 'Owner', initials: 'O' }}
      initial={{ items: [...items, action], nextCursor: 'cursor' }}
      loadOlder={older}
      submitComment={vi.fn().mockResolvedValue(comment)}
      now={new Date('2026-09-06T01:00:00Z')}
    />,
  );
  for (const text of [
    /created this Site/,
    /added allocation plan/,
    /created sign type/,
    /renamed a sign type/,
    /updated sign/,
  ])
    expect(screen.getByText(text)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Load older activity' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Load older activity' }));
  await screen.findByText('Ready for review.');
  expect(screen.getAllByText(/created sign /)).toHaveLength(1);
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Ready for review.' },
  });
  fireEvent.keyDown(screen.getByRole('textbox'), {
    key: 'Enter',
    ctrlKey: true,
  });
  await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
  expect(screen.getAllByText('Ready for review.')).toHaveLength(1);
});
it('suppresses pending work after unmount and delegates unavailable comment failures', async () => {
  for (const operation of ['comment', 'older'] as const) {
    for (const outcome of ['resolve', 'reject'] as const) {
      let resolve: (value: never) => void = () => undefined,
        reject: (error: Error) => void = () => undefined;
      const pending = new Promise<never>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      const view = render(
        <SiteActivityFeed
          initial={{ items: [], nextCursor: 'cursor' }}
          loadOlder={() => pending}
          submitComment={() => pending}
        />,
      );
      if (operation === 'comment') {
        fireEvent.keyDown(screen.getByRole('textbox'), {
          key: 'Enter',
          metaKey: true,
        });
        fireEvent.change(screen.getByRole('textbox'), {
          target: { value: 'Comment' },
        });
        fireEvent.keyDown(screen.getByRole('textbox'), {
          key: 'Enter',
          metaKey: true,
        });
        fireEvent.keyDown(screen.getByRole('textbox'), {
          key: 'Enter',
          metaKey: true,
        });
      } else
        fireEvent.click(
          screen.getByRole('button', { name: 'Load older activity' }),
        );
      view.unmount();
      if (outcome === 'resolve')
        resolve(
          (operation === 'comment'
            ? comment
            : { items: [], nextCursor: null }) as never,
        );
      else reject(new Error('offline'));
      await pending.catch(() => undefined);
    }
  }
  const unavailable = vi.fn().mockReturnValue(true);
  render(
    <SiteActivityFeed
      initial={{ items: [], nextCursor: null }}
      loadOlder={vi.fn()}
      submitComment={vi.fn().mockRejectedValue(new Error('unauthorized'))}
      onUnavailable={unavailable}
    />,
  );
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Comment' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
  await waitFor(() => {
    expect(unavailable).toHaveBeenCalled();
  });
  expect(screen.queryByRole('alert')).toBeNull();
});

it('shows a recoverable pagination failure without an unavailable callback', async () => {
  render(
    <SiteActivityFeed
      initial={{ items: [action], nextCursor: 'cursor' }}
      loadOlder={() => Promise.reject(new Error('offline'))}
      submitComment={() => Promise.resolve(comment)}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Load older activity' }));
  await screen.findByText('We couldn’t load older activity. Please try again.');
});
