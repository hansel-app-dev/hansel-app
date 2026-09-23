/** @spec allocation-plan-comments REQ-002..006,009,011,012 */
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import type {
  CommentCursor,
  CommentPerson,
  PlanCommentThread,
} from '@hansel/contracts';
import type { PlanTool } from './PlanToolbar.js';
import type { PlanCommentsApi } from './plan-comments-api.js';
import {
  CommentRequestError,
  type SignCommentsApi,
} from './sign-comments-api.js';
import { SignComments } from './SignComments.js';
export interface PlanCommentsHandle {
  place: (x: number, y: number, keyboard?: boolean) => void;
  leave: () => boolean;
  clear: () => void;
  keyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
}
const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
export function PlanComments({
  ref,
  api,
  fileId,
  tool,
  panning,
  host,
  beforeOpen,
  onActivateMove,
  onBusyChange,
}: {
  ref: Ref<PlanCommentsHandle>;
  api: PlanCommentsApi;
  fileId: string | null;
  tool: PlanTool;
  panning: boolean;
  host: HTMLElement | null;
  beforeOpen: () => boolean;
  onActivateMove: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const layer = useRef<HTMLDivElement>(null),
    card = useRef<HTMLDivElement>(null),
    active = useRef(true),
    generation = useRef(0),
    state = useRef({ busy: false, dirty: false }),
    resolving = useRef(false),
    keyboard = useRef(false);
  const [rows, setRows] = useState<PlanCommentThread[]>([]),
    [viewer, setViewer] = useState<CommentPerson | null>(null),
    [cursor, setCursor] = useState<CommentCursor | null>(null),
    [showResolved, setShowResolved] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [actionError, setActionError] = useState(''),
    [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<PlanCommentThread | null>(null),
    [draft, setDraft] = useState<{ id: string; x: number; y: number } | null>(
      null,
    ),
    [position, setPosition] = useState<{
      left: number;
      top: number;
      width: number;
      maxHeight: number;
    }>({ left: 0, top: 0, width: 262, maxHeight: 400 }),
    [placementCursor, setPlacementCursor] = useState<{
      x: number;
      y: number;
    } | null>(null);
  const notify = useRef(onBusyChange);
  notify.current = onBusyChange;
  const merge = (incoming: PlanCommentThread[]) => {
    setRows((old) =>
      [
        ...old.filter((r) => !incoming.some((n) => n.id === r.id)),
        ...incoming.map((n) => {
          const previous = old.find((r) => r.id === n.id);
          return previous && previous.updatedAt > n.updatedAt ? previous : n;
        }),
      ].sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      ),
    );
  };
  async function load(next?: CommentCursor) {
    const version = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const page = await api.markers(fileId, showResolved, next);
      if (!active.current || version !== generation.current) return;
      if (next) merge(page.threads);
      else setRows(page.threads);
      setViewer(page.viewer);
      setCursor(page.nextCursor);
    } catch {
      if (active.current && version === generation.current)
        setError('Couldn’t load plan comments.');
    } finally {
      if (active.current && version === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    active.current = true;
    void load();
    return () => {
      active.current = false;
      generation.current++;
      notify.current(false);
    };
  }, [showResolved, api, fileId]);
  const leave = () =>
    !resolving.current &&
    !state.current.busy &&
    (!state.current.dirty || window.confirm('Discard unsent comment?'));
  useEffect(() => {
    const navigate = (event: MouseEvent) => {
      if (
        !(event.target instanceof Element) ||
        card.current?.contains(event.target) ||
        !event.target.closest('a[href], [role="menuitem"]')
      )
        return;
      if (!leave()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (state.current.busy || state.current.dirty || resolving.current)
        event.preventDefault();
    };
    document.addEventListener('click', navigate, true);
    window.addEventListener('beforeunload', unload);
    return () => {
      document.removeEventListener('click', navigate, true);
      window.removeEventListener('beforeunload', unload);
    };
  }, []);
  const clear = () => {
    setSelected(null);
    setDraft(null);
    setActionError('');
    state.current = { busy: false, dirty: false };
    notify.current(false);
  };
  function close() {
    if (!leave()) return;
    const id = selected?.id;
    clear();
    requestAnimationFrame(() => {
      (id ? document.getElementById(`plan-comment-pin-${id}`) : null)?.focus({
        preventScroll: true,
      });
      if (!id) layer.current?.parentElement?.focus({ preventScroll: true });
    });
  }
  function place(x: number, y: number, fromKeyboard = false) {
    if (tool !== 'comment' || panning || !viewer || !leave() || !beforeOpen())
      return;
    clear();
    keyboard.current = fromKeyboard;
    setDraft({ id: crypto.randomUUID(), x: clamp(x), y: clamp(y) });
    setPlacementCursor(null);
  }
  useImperativeHandle(ref, () => ({
    place,
    leave,
    clear,
    keyDown(e) {
      if (panning || tool !== 'comment') return;
      if (e.key === 'Escape') {
        setPlacementCursor(null);
        close();
        return;
      }
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        setPlacementCursor((p) => ({
          x: clamp(
            (p?.x ?? 0.5) +
              (e.key === 'ArrowRight'
                ? 0.01
                : e.key === 'ArrowLeft'
                  ? -0.01
                  : 0),
          ),
          y: clamp(
            (p?.y ?? 0.5) +
              (e.key === 'ArrowDown' ? 0.01 : e.key === 'ArrowUp' ? -0.01 : 0),
          ),
        }));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        place(placementCursor?.x ?? 0.5, placementCursor?.y ?? 0.5, true);
      }
    },
  }));
  useEffect(() => {
    if (tool !== 'comment' || panning) setPlacementCursor(null);
  }, [tool, panning]);
  const point = draft ?? selected;
  useLayoutEffect(() => {
    if (!point) return;
    const update = () => {
      const bounds = layer.current?.getBoundingClientRect(),
        viewport = host?.getBoundingClientRect();
      if (!bounds) return;
      const left = Math.max(8, viewport?.left ?? 8),
        right = Math.min(
          window.innerWidth - 8,
          viewport?.right ?? window.innerWidth - 8,
        ),
        top = Math.max(8, viewport?.top ?? 8),
        bottom = Math.min(
          window.innerHeight - 68,
          viewport?.bottom ?? window.innerHeight - 68,
        );
      const width = Math.min(262, Math.max(180, right - left - 16)),
        height = Math.min(
          card.current?.scrollHeight ?? 300,
          Math.max(128, bottom - top - 16),
        );
      const x = bounds.left + point.x * bounds.width,
        y = bounds.top + point.y * bounds.height;
      setPosition({
        left: clamp(
          x + 38 + width > right ? x - width - 10 : x + (draft ? 26 : 38),
          left,
          right - width,
        ),
        top: clamp(y, top, Math.max(top, bottom - height)),
        width,
        maxHeight: Math.max(128, bottom - top),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const observer = new ResizeObserver(update);
    if (layer.current) observer.observe(layer.current);
    if (card.current) observer.observe(card.current);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [point, host]);
  // Scope the existing composer transport to this plan/file and selected thread.
  const composerApi = useMemo<SignCommentsApi>(
    () => ({
      list: async (_owner, _parent, next) => {
        if (!selected)
          return {
            comments: [],
            nextCursor: null,
            viewer: viewer ?? { id: '', name: '', initials: '' },
          };
        const result = await api.history(fileId, selected.id, next);
        if (active.current) {
          setSelected((current) =>
            current?.id === result.thread.id &&
            current.updatedAt <= result.thread.updatedAt
              ? result.thread
              : current,
          );
          merge([result.thread]);
        }
        return result;
      },
      submit: async (_owner, input) => {
        const result = await api.submit(fileId, {
          idempotencyKey: input.idempotencyKey,
          body: input.body,
          mentions: input.mentions,
          attachmentIds: input.attachmentIds,
          threadId: selected?.id ?? null,
          x: draft?.x ?? null,
          y: draft?.y ?? null,
        });
        if (active.current) {
          merge([result.thread]);
          setSelected(result.thread);
          setDraft(null);
          onActivateMove();
          if (keyboard.current) {
            keyboard.current = false;
            requestAnimationFrame(() => {
              if (
                document.activeElement === document.body ||
                card.current?.contains(document.activeElement)
              )
                document
                  .getElementById(`plan-comment-pin-${result.thread.id}`)
                  ?.focus({ preventScroll: true });
            });
          }
        }
        return result.comment;
      },
      people: (_owner, q, next) => api.people(fileId, q, next),
      initiate: (_owner, input) => api.initiate(fileId, input),
      complete: (_owner, id) => api.complete(fileId, id),
      discard: (_owner, id) => api.discard(fileId, id),
      thumbnail: (_owner, id) => api.thumbnail(fileId, id),
      download: (_owner, id, name) => api.download(fileId, id, name),
      react: () =>
        Promise.reject(new Error('Plan comments do not have reactions.')),
    }),
    [api, fileId, selected?.id, draft, viewer],
  );
  async function changeState() {
    if (!selected || !leave()) return;
    resolving.current = true;
    setPending(true);
    notify.current(true);
    setActionError('');
    try {
      const updated = await api.state(
        fileId,
        selected.id,
        !selected.resolved,
        selected.updatedAt,
      );
      if (!active.current) return;
      merge([updated]);
      if (updated.resolved) clear();
      else setSelected(updated);
    } catch (reason) {
      if (active.current)
        setActionError(
          reason instanceof CommentRequestError && reason.status === 409
            ? 'This thread changed. Close and reopen it to reload.'
            : 'Couldn’t update thread. Please retry.',
        );
    } finally {
      resolving.current = false;
      if (active.current) {
        setPending(false);
        notify.current(false);
      }
    }
  }
  const controls = (
    <div
      className="absolute left-4 top-[66px] z-20 flex max-w-[calc(100%-32px)] flex-wrap items-center gap-2 rounded border border-[#e2e2e7] bg-white px-2 py-1 text-xs shadow-sm"
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={showResolved}
          disabled={pending}
          onChange={(e) => {
            if (!leave()) return;
            clear();
            setShowResolved(e.target.checked);
          }}
        />
        Show resolved
      </label>
      {loading && <span role="status">Loading comments…</span>}
      {!loading &&
        !error &&
        !rows.some((row) => showResolved || !row.resolved) && (
          <span className="text-[#72727e]">No comments</span>
        )}
      {error && (
        <button
          type="button"
          onClick={() => {
            void load();
          }}
          className="text-red-700 underline"
        >
          Retry comments
        </button>
      )}
      {cursor && (
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            void load(cursor);
          }}
          className="underline"
        >
          Load more comments
        </button>
      )}
    </div>
  );
  return (
    <>
      <div
        ref={layer}
        className="pointer-events-none absolute inset-0"
        aria-label="Plan comments"
      >
        {rows
          .filter((r) => showResolved || !r.resolved)
          .map((row) => (
            <button
              key={row.id}
              id={`plan-comment-pin-${row.id}`}
              type="button"
              aria-label={`${row.resolved ? 'Resolved comment' : 'Comment'} by ${row.author.name}: ${row.preview || 'Attachment'}`}
              aria-pressed={selected?.id === row.id}
              disabled={panning || tool === 'hand' || pending}
              className={`absolute z-20 h-[23px] min-w-[30px] rounded-t rounded-br px-1 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${panning || tool === 'hand' ? 'pointer-events-none' : 'pointer-events-auto'} ${row.resolved ? 'bg-[#64748b]' : 'bg-[#4096ff]'}`}
              style={{
                left: `${String(row.x * 100)}%`,
                top: `${String(row.y * 100)}%`,
                cursor: 'pointer',
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (
                  selected?.id === row.id ||
                  !['move', 'comment'].includes(tool) ||
                  !leave() ||
                  !beforeOpen()
                )
                  return;
                clear();
                keyboard.current = e.detail === 0;
                setSelected(row);
                onActivateMove();
              }}
            >
              {row.resolved ? '✓' : row.author.initials}
              <svg
                aria-hidden="true"
                width="7"
                height="7"
                viewBox="0 0 7 7"
                className="absolute -bottom-[7px] left-0"
                style={{ fill: row.resolved ? '#64748b' : '#4096ff' }}
              >
                <path d="M0 0H7L0 7z" />
              </svg>
            </button>
          ))}
        {draft && (
          <span
            aria-hidden="true"
            className="absolute z-20 h-5 w-5 rounded-t rounded-br bg-[#4096ff]"
            style={{
              left: `${String(draft.x * 100)}%`,
              top: `${String(draft.y * 100)}%`,
              clipPath: 'polygon(0 0,100% 0,100% 75%,25% 75%,0 100%)',
            }}
          />
        )}
        {placementCursor && (
          <span
            aria-label="Comment placement cursor"
            className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-500"
            style={{
              left: `${String(placementCursor.x * 100)}%`,
              top: `${String(placementCursor.y * 100)}%`,
            }}
          />
        )}
      </div>
      {host && createPortal(controls, host)}
      {point &&
        viewer &&
        host &&
        createPortal(
          <div
            ref={card}
            role="dialog"
            aria-label={draft ? 'New plan comment' : 'Comment'}
            className={`fixed z-40 flex flex-col overflow-hidden rounded-md border bg-[#fafafa] text-[13px] text-[#27272a] shadow-[0_8px_22px_#00000026] ${draft ? 'border-[#4096ff]' : 'border-[#e2e2e7]'}`}
            style={position}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                e.preventDefault();
                close();
              }
            }}
          >
            {selected ? (
              <header className="flex h-9 shrink-0 items-center justify-between border-b border-[#e2e2e7] px-3">
                <span>Comment{selected.resolved ? ' · Resolved' : ''}</span>
                <span className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={
                      selected.resolved ? 'Reopen thread' : 'Resolve thread'
                    }
                    title={
                      selected.resolved ? 'Reopen thread' : 'Resolve thread'
                    }
                    disabled={pending}
                    onClick={() => {
                      void changeState();
                    }}
                    className="text-[#72727e] focus-visible:outline-2 focus-visible:outline-blue-500"
                  >
                    {selected.resolved ? (
                      '↶'
                    ) : (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="m8 12 3 3 5-6" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label="Close comment"
                    disabled={pending}
                    onClick={close}
                    className="text-lg text-[#72727e]"
                  >
                    ×
                  </button>
                </span>
              </header>
            ) : (
              <button
                type="button"
                aria-label="Close comment"
                onClick={close}
                className="absolute right-1 top-0 z-10 text-[#72727e]"
              >
                ×
              </button>
            )}
            {actionError && (
              <p role="alert" className="p-2 text-xs text-red-700">
                {actionError}
              </p>
            )}
            <SignComments
              key={selected?.id ?? draft?.id ?? 'draft'}
              api={composerApi}
              signId={selected?.id ?? 'draft'}
              compact={{
                draft: !!draft,
                readOnly: !!selected?.resolved || pending,
                onSubmitted: () => undefined,
              }}
              onStateChange={(s) => {
                state.current = s;
                notify.current(s.busy || resolving.current);
              }}
            />
          </div>,
          host,
        )}
    </>
  );
}
