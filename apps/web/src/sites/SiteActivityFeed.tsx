/** @spec site-activity-feed-comments REQ-011..REQ-019 */
import { useEffect, useId, useRef, useState } from 'react';
import type {
  SiteActivityItem,
  SiteActivityPageResponse,
} from '@hansel/contracts';
import { Button } from '../design-system/index.js';
import { relativeTime } from './SiteCollection.js';

const actionCopy = (
  item: Exclude<SiteActivityItem, { kind: 'SITE_COMMENT_ADDED' }>,
) => {
  switch (item.kind) {
    case 'SITE_CREATED':
      return <>created this Site</>;
    case 'ALLOCATION_PLAN_ADDED':
      return (
        <>
          added allocation plan <strong>{item.subjectLabel}</strong>
        </>
      );
    case 'SIGN_TYPE_CREATED':
      return (
        <>
          created sign type <strong>{item.subjectLabel}</strong>
        </>
      );
    case 'SIGN_TYPE_RENAMED':
      return (
        <>
          renamed a sign type to <strong>{item.subjectLabel}</strong>
        </>
      );
    case 'SIGN_CREATED':
      return (
        <>
          created sign <strong>{item.subjectLabel}</strong>
        </>
      );
    case 'SIGN_UPDATED':
      return (
        <>
          updated sign <strong>{item.subjectLabel}</strong>
        </>
      );
  }
};

export function SiteActivityFeed({
  initial,
  loadOlder,
  submitComment,
  onUnavailable,
  now = new Date(),
}: {
  initial: SiteActivityPageResponse;
  loadOlder: (cursor: string) => Promise<SiteActivityPageResponse>;
  submitComment: (text: string) => Promise<SiteActivityItem>;
  onUnavailable?: (error: unknown) => boolean;
  now?: Date;
}) {
  const [items, setItems] = useState(initial.items);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState('');
  const [olderError, setOlderError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const commentId = useId();
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const submit = async () => {
    const value = text.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const created = await submitComment(value);
      if (!active.current) return;
      setItems((current) => [
        created,
        ...current.filter((item) => item.id !== created.id),
      ]);
      setText('');
      setAnnouncement('Comment added.');
    } catch (caught) {
      if (!active.current) return;
      if (onUnavailable?.(caught)) return;
      setError('We couldn’t add your comment. Please try again.');
    } finally {
      if (active.current) setSubmitting(false);
    }
  };
  const older = async () => {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    setOlderError('');
    try {
      const page = await loadOlder(nextCursor);
      if (!active.current) return;
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [
          ...current,
          ...page.items.filter((item) => !known.has(item.id)),
        ];
      });
      setNextCursor(page.nextCursor);
    } catch {
      if (!active.current) return;
      setOlderError('We couldn’t load older activity. Please try again.');
    } finally {
      if (active.current) setLoadingOlder(false);
    }
  };
  return (
    <div className="px-5 pb-5 pt-4">
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-content-muted">
          Site activity will appear here.
        </p>
      ) : (
        <ol className="relative ml-3 border-l border-control-border">
          {items.map((item) => {
            const exact = new Date(item.createdAt).toLocaleString();
            return (
              <li className="relative pb-5 pl-6 text-sm" key={item.id}>
                <span
                  aria-hidden="true"
                  className="absolute -left-[13px] grid size-6 place-items-center rounded-full border border-control-border bg-surface text-[10px] font-semibold"
                >
                  {item.actor.initials}
                </span>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 leading-5">
                    <strong>{item.actor.displayName}</strong>{' '}
                    {item.kind === 'SITE_COMMENT_ADDED'
                      ? 'commented'
                      : actionCopy(item)}
                  </p>
                  <time
                    aria-label={exact}
                    className="shrink-0 text-xs text-content-muted"
                    dateTime={item.createdAt}
                    title={exact}
                  >
                    {relativeTime(item.createdAt, now)}
                  </time>
                </div>
                {item.kind === 'SITE_COMMENT_ADDED' ? (
                  <p className="mt-2 rounded-md border border-control-border px-3 py-2 leading-5">
                    {item.commentText}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      {nextCursor ? (
        <div className="mb-5 text-center">
          <Button
            disabled={loadingOlder}
            onClick={() => void older()}
            type="button"
            variant="secondary"
          >
            {loadingOlder ? 'Loading…' : 'Load older activity'}
          </Button>
          {olderError ? (
            <p className="mt-2 text-sm text-danger" role="alert">
              {olderError}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="rounded-md border border-control-border p-2">
        <label className="sr-only" htmlFor={commentId}>
          Add your comment
        </label>
        <textarea
          aria-describedby={error ? `${commentId}-error` : undefined}
          className="min-h-20 w-full resize-y bg-transparent px-2 py-1 text-sm outline-none"
          id={commentId}
          maxLength={2_000}
          onChange={(event) => {
            setText(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Add your comment…"
          value={text}
        />
        <div className="flex items-center justify-end">
          <Button
            disabled={!text.trim() || submitting}
            onClick={() => void submit()}
            type="button"
            variant="secondary"
          >
            {submitting ? 'Commenting…' : 'Comment'}
          </Button>
        </div>
        {error ? (
          <p
            className="px-2 pt-2 text-sm text-danger"
            id={`${commentId}-error`}
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
