/** @spec sign-comments REQ-001..011 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  commentEmoji,
  type SignComment,
  type CommentCursor,
  type CommentPerson,
  type CommentMention,
} from '@hansel/contracts';
import {
  CommentRequestError,
  type SignCommentsApi,
} from './sign-comments-api.js';
import { useCommentAttachments } from './use-comment-attachments.js';
const focus = 'focus-visible:outline-2 focus-visible:outline-[#4096ff]';
const merge = (old: SignComment[], incoming: SignComment[]) =>
  [
    ...old.filter((row) => !incoming.some((next) => next.id === row.id)),
    ...incoming,
  ].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
export function SignComments({
  api,
  signId,
  onStateChange,
  compact,
}: {
  compact?: { draft: boolean; readOnly: boolean; onSubmitted: () => void };
  api: SignCommentsApi;
  signId: string;
  onStateChange: (state: { busy: boolean; dirty: boolean }) => void;
}) {
  const [rows, setRows] = useState<SignComment[]>([]),
    [viewer, setViewer] = useState<CommentPerson | null>(null),
    [cursor, setCursor] = useState<CommentCursor | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [reply, setReply] = useState<SignComment | null>(null),
    [body, setBody] = useState(''),
    [mentions, setMentions] = useState<CommentMention[]>([]),
    [expanded, setExpanded] = useState(!!compact),
    [pending, setPending] = useState(false),
    [reactionPending, setReactionPending] = useState(false),
    [emojiTarget, setEmojiTarget] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<{
      start: number;
      end: number;
      query: string;
    } | null>(null),
    [people, setPeople] = useState<CommentPerson[]>([]),
    [peopleCursor, setPeopleCursor] = useState<string | null>(null),
    [peopleError, setPeopleError] = useState(''),
    [personIndex, setPersonIndex] = useState(0);
  const mounted = useRef(true),
    posting = useRef(false),
    reacting = useRef(false),
    input = useRef<HTMLTextAreaElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    list = useRef<HTMLDivElement>(null),
    attempt = useRef<{ digest: string; key: string } | null>(null),
    notify = useRef(onStateChange),
    latestQuery = useRef(0);
  notify.current = onStateChange;
  const uploads = useCommentAttachments(api, signId);
  const dirty = !!body || uploads.items.length > 0 || !!reply;
  useEffect(() => {
    notify.current({ busy: pending || uploads.busy || reactionPending, dirty });
  }, [pending, uploads.busy, reactionPending, dirty]);
  async function load(next?: CommentCursor) {
    setLoading(true);
    setError('');
    try {
      const page = await api.list(signId, null, next);
      if (!mounted.current) return;
      setRows((old) => merge(old, page.comments));
      setCursor(page.nextCursor);
      setViewer(page.viewer);
    } catch {
      if (mounted.current) setError('We couldn’t load comments. Please retry.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      notify.current({ busy: false, dirty: false });
    };
  }, []);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (dirty || pending || uploads.busy) event.preventDefault();
    };
    window.addEventListener('beforeunload', leave);
    return () => {
      window.removeEventListener('beforeunload', leave);
    };
  }, [dirty, pending, uploads.busy]);
  useEffect(() => {
    const request = ++latestQuery.current;
    setPeople([]);
    setPeopleCursor(null);
    setPeopleError('');
    setPersonIndex(0);
    if (!mentionQuery) return;
    const timer = setTimeout(() => {
      void api
        .people(signId, mentionQuery.query)
        .then((result) => {
          if (mounted.current && request === latestQuery.current) {
            setPeople(result.people);
            setPeopleCursor(result.nextCursor);
          }
        })
        .catch(() => {
          if (mounted.current && request === latestQuery.current)
            setPeopleError('Couldn’t load people. Try typing again.');
        });
    }, 150);
    return () => {
      clearTimeout(timer);
    };
  }, [mentionQuery?.query]);
  function updateText(next: string, caret: number) {
    // Keep only intact, deliberately selected mention tokens across text edits.
    let start = 0;
    while (
      start < body.length &&
      start < next.length &&
      body[start] === next[start]
    )
      start++;
    let oldEnd = body.length,
      newEnd = next.length;
    while (
      oldEnd > start &&
      newEnd > start &&
      body[oldEnd - 1] === next[newEnd - 1]
    ) {
      oldEnd--;
      newEnd--;
    }
    const shift = newEnd - oldEnd;
    setMentions((old) =>
      old
        .flatMap((mention) =>
          mention.end <= start
            ? [mention]
            : mention.start >= oldEnd
              ? [
                  {
                    ...mention,
                    start: mention.start + shift,
                    end: mention.end + shift,
                  },
                ]
              : [],
        )
        .filter(
          (mention) =>
            next.slice(mention.start, mention.end) === `@${mention.name}`,
        ),
    );
    setBody(next);
    const prefix = next.slice(0, caret),
      at = prefix.lastIndexOf('@');
    setMentionQuery(
      at >= 0 &&
        (at === 0 || /\s/.test(prefix[at - 1] ?? '')) &&
        !/[\n@]/.test(prefix.slice(at + 1)) &&
        !mentions.some((mention) => at >= mention.start && at < mention.end)
        ? { start: at, end: caret, query: prefix.slice(at + 1) }
        : null,
    );
  }
  function insert(text: string) {
    const element = input.current;
    if (!element) return;
    const start = element.selectionStart,
      end = element.selectionEnd;
    updateText(
      body.slice(0, start) + text + body.slice(end),
      start + text.length,
    );
    element.focus();
    requestAnimationFrame(() => {
      element.setSelectionRange(start + text.length, start + text.length);
    });
  }
  function choosePerson(person: CommentPerson) {
    if (!mentionQuery) return;
    const { start, end } = mentionQuery;
    const token = `@${person.name}`;
    const next = body.slice(0, start) + token + ' ' + body.slice(end);
    const shift = token.length + 1 - (end - start);
    setMentions((old) =>
      [
        ...old
          .filter((item) => item.end <= start || item.start >= end)
          .map((item) =>
            item.start >= end
              ? { ...item, start: item.start + shift, end: item.end + shift }
              : item,
          ),
        {
          membershipId: person.id,
          name: person.name,
          start,
          end: start + token.length,
        },
      ].sort((a, b) => a.start - b.start),
    );
    setBody(next);
    setMentionQuery(null);
    input.current?.focus();
    requestAnimationFrame(() => {
      input.current?.setSelectionRange(
        start + token.length + 1,
        start + token.length + 1,
      );
    });
  }
  async function submit() {
    if (
      posting.current ||
      uploads.busy ||
      uploads.items.some((item) => item.state !== 'complete') ||
      (!body.trim() && !uploads.items.length) ||
      Array.from(body).length > 5000
    )
      return;
    posting.current = true;
    setPending(true);
    setError('');
    setMentionQuery(null);
    setEmojiTarget(null);
    const draft = {
      body,
      parentId: reply?.parentId ?? reply?.id ?? null,
      mentions,
      attachmentIds: uploads.items.flatMap((item) =>
        item.attachment ? [item.attachment.id] : [],
      ),
    };
    const digest = JSON.stringify(draft);
    if (attempt.current?.digest !== digest)
      attempt.current = { digest, key: crypto.randomUUID() };
    try {
      const row = await api.submit(signId, {
        ...draft,
        idempotencyKey: attempt.current.key,
      });
      if (!mounted.current) return;
      setRows((old) => merge(old, [row]));
      setBody('');
      setMentions([]);
      setReply(null);
      uploads.committed();
      setExpanded(!!compact);
      attempt.current = null;
      compact?.onSubmitted();
      requestAnimationFrame(() => {
        document
          .getElementById(`comment-${row.id}`)
          ?.scrollIntoView({ block: 'nearest' });
      });
    } catch (reason) {
      if (mounted.current)
        setError(
          reason instanceof CommentRequestError &&
            reason.category === 'mention_unavailable'
            ? 'A mentioned person is no longer available. Remove or reselect the mention.'
            : reason instanceof CommentRequestError && reason.status === 409
              ? 'This discussion changed. Close and reopen it to reload; your unsent draft is retained until you confirm discard.'
              : reason instanceof CommentRequestError &&
                  reason.category === 'comment_capacity_reached'
                ? 'This plan has reached its 5,000 comment thread limit.'
                : reason instanceof CommentRequestError &&
                    reason.category === 'attachment_unavailable'
                  ? 'An attachment has expired. Remove and upload it again.'
                  : 'We couldn’t submit your comment. Please retry.',
        );
    } finally {
      posting.current = false;
      if (mounted.current) setPending(false);
    }
  }
  async function react(row: SignComment, emoji: (typeof commentEmoji)[number]) {
    if (reacting.current) return;
    reacting.current = true;
    setReactionPending(true);
    setError('');
    setEmojiTarget(null);
    try {
      const updated = await api.react(
        signId,
        row.id,
        emoji,
        !row.reactions.find((item) => item.emoji === emoji)?.selected,
      );
      if (mounted.current) setRows((old) => merge(old, [updated]));
    } catch {
      if (mounted.current)
        setError('We couldn’t update this reaction. Please retry.');
    } finally {
      reacting.current = false;
      if (mounted.current) setReactionPending(false);
    }
  }
  function replyTo(row: SignComment) {
    setReply(row);
    setExpanded(true);
    input.current?.focus();
  }
  const rootRows = rows.filter((row) => !row.parentId);
  return (
    <div
      role={compact ? 'group' : 'tabpanel'}
      aria-label={compact ? 'Plan comment discussion' : 'Sign comments'}
      className="flex min-h-0 flex-1 flex-col text-[13px] leading-[15px] text-[#27272a]"
    >
      {!compact?.draft && (
        <div
          ref={list}
          className={
            compact
              ? 'min-h-0 flex-1 overflow-y-auto p-3'
              : 'min-h-0 flex-1 overflow-y-auto px-[23px] pr-6 pt-6 pb-2'
          }
          aria-label="Comment thread"
        >
          {loading && !rows.length ? (
            <p role="status" className="text-center text-sm text-[#72727e]">
              Loading comments…
            </p>
          ) : !rows.length && !error ? (
            <p className="text-center text-sm text-[#72727e]">
              There are no comments yet.
            </p>
          ) : null}
          <div className="space-y-6">
            {compact
              ? rows.map((row) => (
                  <CommentRow
                    key={row.id}
                    row={row}
                    api={api}
                    signId={signId}
                    disabled={pending}
                    onReply={() => undefined}
                    onReact={() => undefined}
                    picker={false}
                    onPicker={() => undefined}
                    onError={setError}
                    hideActions
                  />
                ))
              : rootRows.map((row) => (
                  <CommentThread
                    key={row.id}
                    row={row}
                    rows={rows}
                    api={api}
                    signId={signId}
                    onRows={(incoming) => {
                      if (mounted.current)
                        setRows((old) => merge(old, incoming));
                    }}
                    render={(comment) => (
                      <CommentRow
                        row={comment}
                        api={api}
                        signId={signId}
                        disabled={pending || reactionPending}
                        onReply={() => {
                          replyTo(comment);
                        }}
                        onReact={(emoji) => {
                          void react(comment, emoji);
                        }}
                        picker={emojiTarget === comment.id}
                        onPicker={() => {
                          setEmojiTarget(
                            emojiTarget === comment.id ? null : comment.id,
                          );
                        }}
                        onError={setError}
                      />
                    )}
                  />
                ))}
          </div>
          {cursor && (
            <button
              type="button"
              disabled={loading}
              className={`mt-4 underline ${focus}`}
              onClick={() => {
                void load(cursor);
              }}
            >
              Load more comments
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="shrink-0 px-6 py-2 text-xs text-red-700">
          {error}
          {error.includes('load comments') && (
            <button
              type="button"
              className="ml-1 underline"
              onClick={() => {
                void load();
              }}
            >
              Retry
            </button>
          )}
        </p>
      )}
      {!compact?.readOnly && (
        <div
          className={
            compact
              ? 'relative min-h-0 shrink overflow-y-auto p-0'
              : 'relative shrink-0 border-t border-[#e2e2e7] bg-white pt-[15px] pb-4 pl-[23px] pr-6'
          }
        >
          {reply && (
            <div className="mb-2 ml-10 flex items-center justify-between gap-1 text-xs text-[#64748b]">
              <span>Replying to {reply.author.name}</span>
              <button
                type="button"
                disabled={pending}
                aria-label="Cancel reply"
                className={focus}
                onClick={() => {
                  setReply(null);
                }}
              >
                ×
              </button>
            </div>
          )}
          <div className="flex items-start gap-3">
            {!compact && <Avatar person={viewer} />}
            <div
              className="relative min-w-0 flex-1 rounded-md border border-[#e2e2e7] bg-[#fafafa]"
              onKeyDown={(event) => {
                if (
                  compact &&
                  event.key === 'Escape' &&
                  (mentionQuery || emojiTarget)
                ) {
                  event.stopPropagation();
                  setMentionQuery(null);
                  setEmojiTarget(null);
                  input.current?.focus();
                }
              }}
              onBlur={(event) => {
                if (
                  !event.currentTarget.contains(event.relatedTarget) &&
                  !dirty &&
                  !compact
                ) {
                  setExpanded(false);
                  setEmojiTarget(null);
                  setMentionQuery(null);
                }
              }}
            >
              {mentionQuery && (
                <div
                  className={
                    compact
                      ? 'relative z-20 max-h-32 w-full overflow-y-auto border-b border-[#e2e2e7] bg-white p-1'
                      : 'absolute bottom-full left-0 z-20 mb-1 max-h-48 w-full overflow-y-auto rounded border border-[#e2e2e7] bg-white p-1 shadow-lg'
                  }
                >
                  <div
                    id="comment-mention-options"
                    role="listbox"
                    aria-label="People with Site access"
                  >
                    {people.map((person, i) => (
                      <button
                        key={person.id}
                        id={`mention-${person.id}`}
                        type="button"
                        role="option"
                        aria-selected={i === personIndex}
                        className={`block w-full rounded px-2 py-2 text-left ${i === personIndex ? 'bg-blue-50' : ''} ${focus}`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        onClick={() => {
                          choosePerson(person);
                        }}
                      >
                        {person.name}
                      </button>
                    ))}
                  </div>
                  {!people.length && (
                    <p className="p-2 text-xs">
                      {peopleError || 'No matching people'}
                    </p>
                  )}
                  {peopleCursor && (
                    <button
                      type="button"
                      className="p-2 underline"
                      onClick={() => {
                        const query = mentionQuery.query;
                        void api
                          .people(signId, query, peopleCursor)
                          .then((result) => {
                            if (
                              mounted.current &&
                              query === mentionQuery.query
                            ) {
                              setPeople((old) => [...old, ...result.people]);
                              setPeopleCursor(result.nextCursor);
                            }
                          })
                          .catch(() => {
                            setPeopleError('Couldn’t load more people.');
                          });
                      }}
                    >
                      More people
                    </button>
                  )}
                </div>
              )}
              <textarea
                ref={input}
                aria-label="Write a comment"
                placeholder={
                  compact
                    ? compact.draft
                      ? ''
                      : 'Reply'
                    : 'Write a comment...'
                }
                autoFocus={!!compact && !compact.readOnly}
                disabled={pending}
                value={body}
                onFocus={() => {
                  setExpanded(true);
                }}
                onChange={(event) => {
                  updateText(event.target.value, event.target.selectionStart);
                }}
                onKeyDown={(event) => {
                  if (
                    mentionQuery &&
                    ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(
                      event.key,
                    )
                  ) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.key === 'Escape') setMentionQuery(null);
                    else if (event.key === 'Enter') {
                      const person = people[personIndex];
                      if (person) choosePerson(person);
                    } else
                      setPersonIndex((index) =>
                        Math.max(
                          0,
                          Math.min(
                            people.length - 1,
                            index + (event.key === 'ArrowDown' ? 1 : -1),
                          ),
                        ),
                      );
                  } else if (
                    (event.ctrlKey || event.metaKey) &&
                    event.key === 'Enter'
                  ) {
                    event.preventDefault();
                    void submit();
                  }
                }}
                aria-controls={
                  mentionQuery ? 'comment-mention-options' : undefined
                }
                className={`block w-full resize-none rounded-t-md bg-transparent px-[11px] py-[10px] text-[12px] leading-4 placeholder:text-[#72727e] ${focus} ${expanded ? 'h-[71px]' : 'h-[54px] pr-[87px]'}`}
              />
              {!!uploads.items.length && (
                <div className="max-h-40 space-y-2 overflow-y-auto px-3 pb-2">
                  {uploads.items.map((item) => (
                    <div
                      key={item.key}
                      className="rounded border border-[#d4d4d8] bg-white p-2 text-xs"
                    >
                      <div className="flex gap-2">
                        <span
                          className="min-w-0 flex-1 truncate"
                          title={item.file.name}
                        >
                          {item.file.name}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${item.file.name}`}
                          disabled={pending}
                          className={focus}
                          onClick={() => {
                            uploads.remove(item.key);
                          }}
                        >
                          ×
                        </button>
                      </div>
                      {item.state === 'error' ? (
                        <>
                          <p role="alert" className="text-red-700">
                            {item.error}
                          </p>
                          {!item.error?.startsWith('Choose') && (
                            <button
                              type="button"
                              className="underline"
                              onClick={() => {
                                uploads.retry(item.key);
                              }}
                            >
                              Retry upload
                            </button>
                          )}
                        </>
                      ) : item.state === 'complete' ? (
                        <span>Ready</span>
                      ) : (
                        <>
                          <span>
                            {item.uploaded
                              ? 'Verifying…'
                              : `Uploading ${String(item.progress)}%`}
                          </span>
                          <progress
                            aria-label={`Uploading ${item.file.name}`}
                            className="h-1 w-full"
                            value={item.progress}
                            max={100}
                          />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {uploads.error && (
                <p role="alert" className="px-3 text-xs text-red-700">
                  {uploads.error}
                </p>
              )}
              {Array.from(body).length > 5000 && (
                <p role="alert" className="px-3 text-xs text-red-700">
                  Comments can have up to 5,000 characters.
                </p>
              )}
              <div
                className={
                  expanded
                    ? 'flex h-[55px] items-center justify-between border-t border-[#e2e2e7] px-[11px]'
                    : 'absolute right-[11px] top-[11px]'
                }
              >
                {expanded && (
                  <div className="flex items-center gap-3 text-[#72727e]">
                    <button
                      type="button"
                      aria-label="Attach files"
                      disabled={pending}
                      className={focus}
                      onClick={() => {
                        fileInput.current?.click();
                      }}
                    >
                      <CommentIcon name="attach" />
                    </button>
                    <button
                      type="button"
                      aria-label="Mention a person"
                      disabled={pending}
                      className={`grid size-5 place-items-center ${focus}`}
                      onClick={() => {
                        insert('@');
                      }}
                    >
                      <CommentIcon name="mention" />
                    </button>
                    <button
                      type="button"
                      aria-label="Insert emoji"
                      disabled={pending}
                      className={focus}
                      onClick={() => {
                        setEmojiTarget(
                          emojiTarget === 'composer' ? null : 'composer',
                        );
                      }}
                    >
                      <CommentIcon name="smile" />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  disabled={
                    pending ||
                    !viewer ||
                    uploads.busy ||
                    uploads.items.some((item) => item.state !== 'complete') ||
                    (!body.trim() && !uploads.items.length) ||
                    Array.from(body).length > 5000
                  }
                  onClick={() => {
                    void submit();
                  }}
                  className={`h-8 rounded bg-[#475569] px-3 text-sm text-white disabled:bg-[#d4d4d8] disabled:text-[#72727e] ${focus}`}
                >
                  {pending ? 'Submitting…' : 'Submit'}
                </button>
              </div>
              {emojiTarget === 'composer' && (
                <div
                  className={
                    compact
                      ? 'relative z-20 border-t bg-white p-2'
                      : 'absolute bottom-[56px] right-0 z-20 rounded border bg-white p-2 shadow-lg'
                  }
                >
                  <EmojiPicker
                    onChoose={(emoji) => {
                      insert(emoji);
                      setEmojiTarget(null);
                    }}
                    onClose={() => {
                      setEmojiTarget(null);
                    }}
                  />
                </div>
              )}
              <input
                ref={fileInput}
                type="file"
                multiple
                accept="image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf"
                aria-label="Comment attachments"
                disabled={pending}
                className="sr-only"
                onChange={(event) => {
                  uploads.add(Array.from(event.target.files ?? []));
                  event.target.value = '';
                  setExpanded(true);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function CommentThread({
  row,
  rows,
  api,
  signId,
  onRows,
  render,
}: {
  row: SignComment;
  rows: SignComment[];
  api: SignCommentsApi;
  signId: string;
  onRows: (rows: SignComment[]) => void;
  render: (row: SignComment) => ReactNode;
}) {
  const [cursor, setCursor] = useState<CommentCursor | null>(null),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(false);
  const active = useRef(true),
    notify = useRef(onRows);
  notify.current = onRows;
  async function load(next?: CommentCursor) {
    setLoading(true);
    setError(false);
    try {
      const page = await api.list(signId, row.id, next);
      if (active.current) {
        notify.current(page.comments);
        setCursor(page.nextCursor);
      }
    } catch {
      if (active.current) setError(true);
    } finally {
      if (active.current) setLoading(false);
    }
  }
  useEffect(() => {
    active.current = true;
    void load();
    return () => {
      active.current = false;
    };
  }, []);
  const replies = rows.filter((item) => item.parentId === row.id);
  return (
    <div>
      {render(row)}
      {!!replies.length && (
        <div className="relative ml-[14px] mt-5 border-l border-[#e2e2e7] pl-[13px] space-y-5 rounded-bl-xl">
          {replies.map((reply) => (
            <div key={reply.id}>{render(reply)}</div>
          ))}
        </div>
      )}
      {error && (
        <button
          type="button"
          className="ml-9 mt-2 text-xs text-red-700 underline"
          onClick={() => {
            void load();
          }}
        >
          Retry replies
        </button>
      )}
      {cursor && (
        <button
          type="button"
          disabled={loading}
          className="ml-9 mt-2 text-xs underline"
          onClick={() => {
            void load(cursor);
          }}
        >
          More replies
        </button>
      )}
    </div>
  );
}
function CommentRow({
  row,
  api,
  signId,
  disabled,
  onReply,
  onReact,
  picker,
  onPicker,
  onError,
  hideActions = false,
}: {
  hideActions?: boolean;
  row: SignComment;
  api: SignCommentsApi;
  signId: string;
  disabled: boolean;
  onReply: () => void;
  onReact: (emoji: (typeof commentEmoji)[number]) => void;
  picker: boolean;
  onPicker: () => void;
  onError: (error: string) => void;
}) {
  const age = Math.max(0, Date.now() - new Date(row.createdAt).getTime());
  const hours = Math.floor(age / 3600000);
  const days = Math.floor(hours / 24);
  const time = days
    ? `${String(days)} ${days === 1 ? 'day' : 'days'} ago`
    : hours
      ? `${String(hours)} ${hours === 1 ? 'hour' : 'hours'} ago`
      : 'Just now';
  const parts: ReactNode[] = [];
  let offset = 0;
  for (const mention of row.mentions) {
    parts.push(row.body.slice(offset, mention.start));
    parts.push(
      <span
        key={`${String(mention.start)}-${mention.membershipId}`}
        className="text-[#4096ff]"
      >
        {row.body.slice(mention.start, mention.end)}
      </span>,
    );
    offset = mention.end;
  }
  parts.push(row.body.slice(offset));
  return (
    <article
      id={`comment-${row.id}`}
      className="flex min-w-0 items-start gap-2"
    >
      <Avatar person={row.author} />
      <div className="min-w-0 flex-1 pt-[5px]">
        <div className="flex flex-wrap gap-x-[6px]">
          <span>{row.author.name}</span>
          <time
            title={new Date(row.createdAt).toLocaleString()}
            dateTime={row.createdAt}
            className="text-[#72727e]"
          >
            {time}
          </time>
        </div>
        {row.body && (
          <p className="mt-1 whitespace-pre-wrap break-words">{parts}</p>
        )}
        {row.attachments.map((file) => (
          <div key={file.id} className="mt-[6px]">
            {file.mediaType === 'application/pdf' ? (
              <button
                type="button"
                className={`flex h-9 w-full items-center gap-2 rounded-md border border-[#e2e2e7] px-1 text-left ${focus}`}
                title={file.filename}
                onClick={() => {
                  void api
                    .download(signId, file.id, file.filename)
                    .catch(() => {
                      onError('Download failed. Please retry.');
                    });
                }}
              >
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded bg-[#f4f4f5] text-[#334155]"
                >
                  <CommentIcon name="pdf" />
                </span>
                <span className="min-w-0 truncate">{file.filename}</span>
              </button>
            ) : (
              <CommentImage
                api={api}
                signId={signId}
                id={file.id}
                filename={file.filename}
                onError={onError}
              />
            )}
          </div>
        ))}
        {!hideActions && (
          <div className="relative mt-2 flex flex-wrap items-center gap-1 text-[#72727e]">
            <button
              type="button"
              aria-label={`React to comment by ${row.author.name}`}
              disabled={disabled}
              className={focus}
              onClick={onPicker}
            >
              <CommentIcon name="smile" small />
            </button>
            <span aria-hidden="true">
              <CommentIcon name="check" small />
            </span>
            <button
              type="button"
              disabled={disabled}
              className={`px-0.5 text-xs text-[#526581] ${focus}`}
              onClick={onReply}
            >
              Reply
            </button>
            {row.reactions.map((reaction) => (
              <button
                type="button"
                key={reaction.emoji}
                disabled={disabled}
                aria-pressed={reaction.selected}
                aria-label={`${reaction.emoji} reaction, ${String(reaction.count)}`}
                className={`rounded-full border px-1.5 py-0.5 text-xs ${reaction.selected ? 'border-blue-300 bg-blue-50' : 'border-[#e2e2e7]'} ${focus}`}
                onClick={() => {
                  onReact(reaction.emoji);
                }}
              >
                {reaction.emoji} {reaction.count}
              </button>
            ))}
            {picker && (
              <div className="absolute left-0 top-6 z-20 rounded border bg-white p-2 shadow-lg">
                <EmojiPicker onChoose={onReact} onClose={onPicker} />
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
function CommentImage({
  api,
  signId,
  id,
  filename,
  onError,
}: {
  api: SignCommentsApi;
  signId: string;
  id: string;
  filename: string;
  onError: (error: string) => void;
}) {
  const [url, setUrl] = useState(''),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true,
      objectUrl = '';
    setError(false);
    void api
      .thumbnail(signId, id)
      .then((blob) => {
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [signId, id, attempt]);
  return (
    <div className="group relative h-[170px] overflow-hidden rounded bg-[#f1f5f9]">
      {error ? (
        <button
          type="button"
          className="p-2 underline"
          onClick={() => {
            setAttempt((value) => value + 1);
          }}
        >
          Retry image
        </button>
      ) : url ? (
        <img
          src={url}
          alt={filename}
          className="h-full w-full object-cover"
          onError={() => {
            setError(true);
          }}
        />
      ) : (
        <span role="status">Loading image…</span>
      )}
      <button
        type="button"
        aria-label={`Download ${filename}`}
        className={`absolute bottom-2 right-2 rounded bg-white p-1 opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 ${focus}`}
        onClick={() => {
          void api.download(signId, id, filename).catch(() => {
            onError('Download failed. Please retry.');
          });
        }}
      >
        <CommentIcon name="download" />
      </button>
    </div>
  );
}
function Avatar({ person }: { person: CommentPerson | null }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-7 shrink-0 place-items-center rounded-full bg-[#64748b] text-xs font-semibold text-white"
    >
      {person?.initials ?? '…'}
    </span>
  );
}
function EmojiPicker({
  onChoose,
  onClose,
}: {
  onChoose: (emoji: (typeof commentEmoji)[number]) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="Choose emoji"
      className="flex gap-1"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      {commentEmoji.map((emoji) => (
        <button
          type="button"
          key={emoji}
          aria-label={emoji}
          className={`size-7 text-base ${focus}`}
          onClick={() => {
            onChoose(emoji);
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
function CommentIcon({
  name,
  small = false,
}: {
  name: 'attach' | 'smile' | 'check' | 'mention' | 'pdf' | 'download';
  small?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      className="block shrink-0"
      width={small ? 18 : 20}
      height={small ? 18 : 20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={small ? 1.5 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'attach' ? (
        <path d="M18 7v10a6 6 0 0 1-12 0V6a4 4 0 0 1 8 0v11a2 2 0 0 1-4 0V7" />
      ) : name === 'mention' ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M16 8v6a3 3 0 0 0 6 0v-2a10 10 0 1 0-4 8" />
        </>
      ) : name === 'download' ? (
        <path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5" />
      ) : name === 'pdf' ? (
        <>
          <path d="M7 3h14v16H7zM3 7v16h14" />
          <path
            strokeWidth="1.1"
            d="M10 14v-5h1.2a1.3 1.3 0 0 1 0 2.6H10m4 2.4V9h.8c2 0 2 5 0 5H14m4 0V9h2m-2 2.5h1.5"
          />
        </>
      ) : name === 'check' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5 5.5-6" />
        </>
      ) : (
        <>
          <path d="M21 12a9 9 0 1 1-9-9M20 2v6m-3-3h6M8 14s1.5 2 4 2 4-2 4-2" />
          <path d="M9 9h.01M15 9h.01" strokeWidth="2.5" />
        </>
      )}
    </svg>
  );
}
