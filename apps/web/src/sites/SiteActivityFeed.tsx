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
  viewer,
  initial,
  loadOlder,
  submitComment,
  onUnavailable,
  now = new Date(),
}: {
  viewer?: { displayName: string; initials: string };
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
  const older = async (cursor: string) => {
    setLoadingOlder(true);
    setOlderError('');
    try {
      const page = await loadOlder(cursor);
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
    <div className="px-5 pb-[34px] pt-6">
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-content-muted">
          Site activity will appear here.
        </p>
      ) : (
        <ol className="relative ml-[10px] border-l border-[#e2e6ec]">
          {items.map((item) => {
            const exact = new Date(item.createdAt).toLocaleString();
            const isComment = item.kind === 'SITE_COMMENT_ADDED';
            return (
              <li
                className={`relative pl-6 ${isComment ? 'pb-6' : 'min-h-[42px] pb-6'}`}
                key={item.id}
              >
                <span
                  aria-hidden="true"
                  className={
                    isComment
                      ? 'absolute -left-[10px] top-[10px] grid size-5 place-items-center rounded-full bg-[#64748b] text-[8px] font-semibold text-white ring-4 ring-white'
                      : 'absolute -left-[4px] top-[5px] size-[7px] rounded-full border border-[#cbd2dc] bg-white ring-[6px] ring-white'
                  }
                >
                  {isComment ? item.actor.initials : null}
                </span>
                <div
                  data-activity-comment-card={isComment ? '' : undefined}
                  className={
                    isComment
                      ? 'min-h-[84px] rounded-[5px] border border-[#dfe3e9] px-[10px] py-[11px]'
                      : ''
                  }
                >
                  <div className="flex items-start justify-between gap-2 text-[10px] leading-[16px] text-[#475569]">
                    <p className="min-w-0 break-words">
                      <strong className="font-medium text-[#0f172a]">
                        {item.actor.displayName}
                      </strong>{' '}
                      {item.kind === 'SITE_COMMENT_ADDED'
                        ? 'commented'
                        : actionCopy(item)}
                    </p>
                    <time
                      aria-label={exact}
                      className="shrink-0 text-[10px] leading-[16px] text-[#475569]"
                      dateTime={item.createdAt}
                      title={exact}
                    >
                      {relativeTime(item.createdAt, now).replace(
                        / (minute|hour|day|month|year)s? ago$/,
                        (
                          _match,
                          unit: 'minute' | 'hour' | 'day' | 'month' | 'year',
                        ) =>
                          `${{ minute: 'm', hour: 'h', day: 'd', month: 'mo', year: 'y' }[unit]} ago`,
                      )}
                    </time>
                  </div>
                  {item.kind === 'SITE_COMMENT_ADDED' ? (
                    <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-[21px] text-[#475569]">
                      {item.commentText}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {nextCursor ? (
        <div className="mb-5 text-center">
          <Button
            disabled={loadingOlder}
            onClick={() => void older(nextCursor)}
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
      <div className="grid grid-cols-[20px_minmax(0,1fr)] items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-5 place-items-center rounded-full bg-[#64748b] text-[8px] font-semibold text-white"
        >
          {viewer?.initials ?? (
            <svg
              viewBox="0 0 20 20"
              className="size-4"
              fill="none"
              stroke="currentColor"
            >
              <circle cx="10" cy="7" r="3" />
              <path d="M4 17a6 6 0 0 1 12 0" />
            </svg>
          )}
        </span>
        <div className="min-w-0 rounded-[7px] border border-[#cdd3de] p-[6px] focus-within:border-focus">
          <label className="sr-only" htmlFor={commentId}>
            Add your comment
          </label>
          <textarea
            aria-describedby={error ? `${commentId}-error` : undefined}
            className="block min-h-[52px] w-full resize-none bg-transparent px-1 py-0 text-[12px] leading-[18px] text-[#475569] outline-none placeholder:text-[#7c8aa2]"
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
              className="!min-h-7 !rounded-[5px] !px-2 !py-1 !text-[12px] !leading-[18px] !shadow-none"
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
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
