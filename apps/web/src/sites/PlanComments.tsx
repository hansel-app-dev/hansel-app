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
  type PointerEvent,
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
interface Point {
  x: number;
  y: number;
}
type MoveIntent = Point & { thread: PlanCommentThread };
interface PinDrag {
  pointerId: number;
  target: HTMLButtonElement;
  thread: PlanCommentThread | null;
  origin: Point;
  start: Point;
  offset: Point;
  moved: boolean;
  next: Point;
}
const step = (value: number, delta: number) =>
  Math.round(clamp(value + delta) * 10000) / 10000;
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
    keyboard = useRef(false),
    drag = useRef<PinDrag | null>(null),
    moving = useRef(false),
    draftAttempted = useRef(false),
    scope = useRef(0),
    suppressClick = useRef(false),
    clickGuard = useRef<{ id: string; allowed: boolean } | null>(null);
  const [preview, setPreview] = useState<(Point & { id: string }) | null>(null),
    [dragging, setDragging] = useState(false),
    [draftLocked, setDraftLocked] = useState(false),
    [moveFailure, setMoveFailure] = useState<
      (MoveIntent & { conflict: boolean }) | null
    >(null),
    [announcement, setAnnouncement] = useState('');
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
    !drag.current &&
    !moving.current &&
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
      if (
        state.current.busy ||
        state.current.dirty ||
        resolving.current ||
        moving.current ||
        drag.current
      )
        event.preventDefault();
    };
    document.addEventListener('click', navigate, true);
    window.addEventListener('beforeunload', unload);
    return () => {
      document.removeEventListener('click', navigate, true);
      window.removeEventListener('beforeunload', unload);
    };
  }, []);
  function cancelDrag() {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    suppressClick.current = current.moved;
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    setPreview(null);
    setDragging(false);
    if (current.target.hasPointerCapture(current.pointerId))
      current.target.releasePointerCapture(current.pointerId);
    notify.current(state.current.busy || resolving.current || moving.current);
  }
  useEffect(() => {
    scope.current++;
    moving.current = false;
    resolving.current = false;
    state.current = { busy: false, dirty: false };
    setPending(false);
    setPreview(null);
    setActionError('');
    notify.current(false);
    setSelected(null);
    setDraft(null);
    setRows([]);
    setViewer(null);
    setCursor(null);
    setMoveFailure(null);
    draftAttempted.current = false;
    setDraftLocked(false);
    return () => {
      scope.current++;
      cancelDrag();
    };
  }, [api, fileId]);
  useEffect(() => {
    cancelDrag();
  }, [tool, panning]);
  useEffect(() => {
    const cancel = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && drag.current) {
        event.preventDefault();
        event.stopPropagation();
        cancelDrag();
      }
    };
    window.addEventListener('keydown', cancel, true);
    return () => {
      window.removeEventListener('keydown', cancel, true);
    };
  }, []);
  const clear = () => {
    cancelDrag();
    draftAttempted.current = false;
    setDraftLocked(false);
    setMoveFailure(null);
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
  async function savePosition(intent: MoveIntent) {
    if (moving.current || resolving.current || state.current.busy) return;
    const version = scope.current;
    const restoreFocus =
      document.activeElement?.id === `plan-comment-pin-${intent.thread.id}`;
    moving.current = true;
    setPending(true);
    setMoveFailure(null);
    setPreview({ id: intent.thread.id, x: intent.x, y: intent.y });
    notify.current(true);
    setAnnouncement('Saving comment position…');
    try {
      const updated = await api.position(
        fileId,
        intent.thread.id,
        intent.x,
        intent.y,
        intent.thread.updatedAt,
      );
      if (version !== scope.current || !active.current) return;
      merge([updated]);
      setSelected((current) =>
        current?.id === updated.id ? updated : current,
      );
      setAnnouncement('Comment position saved.');
    } catch (reason) {
      if (!active.current || version !== scope.current) return;
      setMoveFailure({
        ...intent,
        conflict:
          reason instanceof CommentRequestError && reason.status === 409,
      });
      setAnnouncement('Comment position was not saved.');
    } finally {
      if (version === scope.current) {
        moving.current = false;
        if (active.current) {
          setPending(false);
          setPreview(null);
          notify.current(state.current.busy);
          if (restoreFocus)
            requestAnimationFrame(() => {
              if (
                active.current &&
                version === scope.current &&
                document.activeElement === document.body
              )
                document
                  .getElementById(`plan-comment-pin-${intent.thread.id}`)
                  ?.focus({ preventScroll: true });
            });
        }
      }
    }
  }
  function canMove(row: PlanCommentThread | null) {
    return (
      ['move', 'comment'].includes(tool) &&
      !panning &&
      !row?.resolved &&
      !moving.current &&
      !resolving.current &&
      !state.current.busy &&
      !drag.current &&
      (row !== null || !draftAttempted.current) &&
      !(moveFailure?.conflict && moveFailure.thread.id === row?.id)
    );
  }
  function prepareMove(row: PlanCommentThread | null) {
    if (!canMove(row)) return false;
    // Keep an unsent reply when moving its own pin.
    if (row && selected?.id !== row.id && (!leave() || !beforeOpen()))
      return false;
    return true;
  }
  function startDrag(
    e: PointerEvent<HTMLButtonElement>,
    row: PlanCommentThread | null,
  ) {
    e.stopPropagation();
    suppressClick.current = false;
    clickGuard.current = null;
    if (e.button !== 0 || !e.isPrimary || !canMove(row)) return;
    const allowed = prepareMove(row);
    if (row) clickGuard.current = { id: row.id, allowed };
    if (!allowed) return;
    const bounds = layer.current?.getBoundingClientRect(),
      origin = row ?? draft;
    if (!bounds?.width || !bounds.height || !origin) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      pointerId: e.pointerId,
      target: e.currentTarget,
      thread: row,
      origin,
      start: { x: e.clientX, y: e.clientY },
      offset: {
        x: e.clientX - bounds.left - origin.x * bounds.width,
        y: e.clientY - bounds.top - origin.y * bounds.height,
      },
      moved: false,
      next: origin,
    };
    notify.current(true);
  }
  function updateDrag(e: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (current?.pointerId !== e.pointerId) return;
    e.stopPropagation();
    if (
      !current.moved &&
      Math.hypot(e.clientX - current.start.x, e.clientY - current.start.y) < 3
    )
      return;
    if (
      !current.moved &&
      current.thread &&
      selected?.id !== current.thread.id
    ) {
      // The discard guard ran at pointer down, before acquiring capture.
      setDraft(null);
      draftAttempted.current = false;
      setDraftLocked(false);
      setSelected(current.thread);
      setActionError('');
      state.current = { busy: false, dirty: false };
    }
    const bounds = layer.current?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return;
    current.moved = true;
    current.next = {
      x: clamp((e.clientX - bounds.left - current.offset.x) / bounds.width),
      y: clamp((e.clientY - bounds.top - current.offset.y) / bounds.height),
    };
    setDragging(true);
    setPreview({ id: current.thread?.id ?? draft?.id ?? '', ...current.next });
  }
  function finishDrag(e: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    setTimeout(() => {
      clickGuard.current = null;
    }, 0);
    if (current?.pointerId !== e.pointerId) return;
    e.stopPropagation();
    updateDrag(e);
    drag.current = null;
    suppressClick.current = current.moved;
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    setDragging(false);
    setPreview(null);
    if (current.target.hasPointerCapture(current.pointerId))
      current.target.releasePointerCapture(current.pointerId);
    notify.current(state.current.busy || resolving.current);
    if (!current.moved) return;
    if (current.thread) {
      if (
        current.next.x !== current.origin.x ||
        current.next.y !== current.origin.y
      )
        void savePosition({ thread: current.thread, ...current.next });
    } else {
      setDraft((value) => (value ? { ...value, ...current.next } : value));
      setAnnouncement('Comment position updated.');
    }
  }
  function moveKey(
    e: KeyboardEvent<HTMLButtonElement>,
    row: PlanCommentThread | null,
  ) {
    if (!e.altKey || !e.key.startsWith('Arrow')) return;
    e.preventDefault();
    e.stopPropagation();
    if (!prepareMove(row)) return;
    const origin = row ?? draft;
    if (!origin) return;
    const next = {
      x: step(
        origin.x,
        e.key === 'ArrowRight' ? 0.01 : e.key === 'ArrowLeft' ? -0.01 : 0,
      ),
      y: step(
        origin.y,
        e.key === 'ArrowDown' ? 0.01 : e.key === 'ArrowUp' ? -0.01 : 0,
      ),
    };
    if (next.x === origin.x && next.y === origin.y) return;
    if (row) {
      if (selected?.id !== row.id) {
        clear();
        setSelected(row);
      }
      void savePosition({ thread: row, ...next });
    } else {
      setDraft((value) => (value ? { ...value, ...next } : value));
      setAnnouncement('Comment position updated.');
    }
  }
  const point =
    preview && preview.id === (draft?.id ?? selected?.id)
      ? preview
      : (draft ?? selected);
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
        const version = scope.current;
        const result = await api.history(fileId, selected.id, next);
        if (active.current && version === scope.current) {
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
        const version = scope.current;
        if (draft) {
          draftAttempted.current = true;
          setDraftLocked(true);
        }
        const result = await api.submit(fileId, {
          idempotencyKey: input.idempotencyKey,
          body: input.body,
          mentions: input.mentions,
          attachmentIds: input.attachmentIds,
          threadId: selected?.id ?? null,
          x: draft?.x ?? null,
          y: draft?.y ?? null,
        });
        if (active.current && version === scope.current) {
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
    const version = scope.current;
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
      if (!active.current || version !== scope.current) return;
      merge([updated]);
      if (updated.resolved) clear();
      else setSelected(updated);
    } catch (reason) {
      if (active.current && version === scope.current)
        setActionError(
          reason instanceof CommentRequestError && reason.status === 409
            ? 'This thread changed. Close and reopen it to reload.'
            : 'Couldn’t update thread. Please retry.',
        );
    } finally {
      if (version === scope.current) {
        resolving.current = false;
        if (active.current) {
          setPending(false);
          notify.current(false);
        }
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
          disabled={pending || dragging}
          onChange={(e) => {
            if (!leave()) return;
            clear();
            setShowResolved(e.target.checked);
          }}
        />
        Show resolved
      </label>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
      <span id="comment-move-help" className="sr-only">
        Drag an open comment to move it, or press Alt and an arrow key to move
        one percent. Escape cancels a drag.
      </span>
      {moving.current && <span>Saving position…</span>}
      {moveFailure && (
        <>
          <span role="alert">
            {moveFailure.conflict
              ? 'This thread changed. Reload before moving it.'
              : 'Couldn’t save comment position.'}
          </span>
          <button
            type="button"
            className="underline"
            disabled={pending || dragging}
            onClick={() => {
              if (!moveFailure.conflict) {
                void savePosition(moveFailure);
                return;
              }
              const version = scope.current;
              moving.current = true;
              setPending(true);
              notify.current(true);
              void api
                .history(fileId, moveFailure.thread.id)
                .then((result) => {
                  if (!active.current || version !== scope.current) return;
                  merge([result.thread]);
                  setSelected((current) =>
                    current?.id === result.thread.id ? result.thread : current,
                  );
                  setMoveFailure(null);
                  setAnnouncement('Comment reloaded.');
                })
                .catch(() => {
                  if (active.current && version === scope.current)
                    setAnnouncement('Couldn’t reload comment.');
                })
                .finally(() => {
                  if (version === scope.current) {
                    moving.current = false;
                    setPending(false);
                    notify.current(state.current.busy);
                  }
                });
            }}
          >
            {moveFailure.conflict ? 'Reload comment' : 'Retry comment move'}
          </button>
        </>
      )}
      {loading && <span role="status">Loading comments…</span>}
      {!loading &&
        !error &&
        !rows.some((row) => showResolved || !row.resolved) && (
          <span className="text-[#72727e]">No comments</span>
        )}
      {error && (
        <button
          type="button"
          disabled={pending || dragging}
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
          disabled={loading || pending || dragging}
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
              aria-describedby="comment-move-help"
              disabled={panning || tool === 'hand' || pending}
              className={`absolute z-20 h-[23px] min-w-[30px] rounded-t rounded-br px-1 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${panning || tool === 'hand' ? 'pointer-events-none' : 'pointer-events-auto'} ${row.resolved ? 'bg-[#64748b]' : 'bg-[#4096ff]'}`}
              style={{
                left: `${String((preview?.id === row.id ? preview.x : row.x) * 100)}%`,
                top: `${String((preview?.id === row.id ? preview.y : row.y) * 100)}%`,
                cursor: dragging
                  ? 'grabbing'
                  : !row.resolved &&
                      ['move', 'comment'].includes(tool) &&
                      !panning &&
                      !pending
                    ? 'grab'
                    : 'pointer',
                touchAction: 'none',
              }}
              onPointerDown={(e) => {
                startDrag(e, row);
              }}
              onPointerMove={updateDrag}
              onPointerUp={finishDrag}
              onPointerCancel={cancelDrag}
              onLostPointerCapture={cancelDrag}
              onKeyDown={(e) => {
                moveKey(e, row);
              }}
              onClick={(e) => {
                e.stopPropagation();
                const guard =
                  e.detail !== 0 && clickGuard.current?.id === row.id
                    ? clickGuard.current
                    : null;
                clickGuard.current = null;
                if (suppressClick.current || guard?.allowed === false) {
                  suppressClick.current = false;
                  return;
                }
                if (
                  selected?.id === row.id ||
                  !['move', 'comment'].includes(tool) ||
                  (!guard && (!leave() || !beforeOpen()))
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
          <button
            type="button"
            aria-label="New comment pin"
            aria-describedby="comment-move-help"
            disabled={draftLocked || pending || panning || tool === 'hand'}
            onPointerDown={(e) => {
              startDrag(e, null);
            }}
            onPointerMove={updateDrag}
            onPointerUp={finishDrag}
            onPointerCancel={cancelDrag}
            onLostPointerCapture={cancelDrag}
            onKeyDown={(e) => {
              moveKey(e, null);
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="pointer-events-auto absolute z-20 h-5 w-5 rounded-t rounded-br bg-[#4096ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            style={{
              left: `${String((preview?.id === draft.id ? preview.x : draft.x) * 100)}%`,
              top: `${String((preview?.id === draft.id ? preview.y : draft.y) * 100)}%`,
              touchAction: 'none',
              cursor: dragging ? 'grabbing' : 'grab',
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
                    disabled={pending || dragging}
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
                    disabled={pending || dragging}
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
            {draft && (
              <div
                className="flex flex-wrap gap-2 border-b border-[#e2e2e7] px-3 py-2 text-xs"
                role="group"
                aria-label="Comment position"
              >
                <span>
                  {draftLocked
                    ? 'Position locked for submission retry.'
                    : 'Drag pin to move, or use these controls.'}
                </span>
                {(['left', 'right', 'up', 'down'] as const).map((direction) => (
                  <button
                    key={direction}
                    type="button"
                    aria-label={`Move comment ${direction}`}
                    disabled={
                      draftLocked ||
                      pending ||
                      dragging ||
                      panning ||
                      tool === 'hand'
                    }
                    className="underline"
                    onClick={() => {
                      if (draftAttempted.current || state.current.busy) return;
                      setDraft((value) =>
                        value
                          ? {
                              ...value,
                              x: step(
                                value.x,
                                direction === 'right'
                                  ? 0.01
                                  : direction === 'left'
                                    ? -0.01
                                    : 0,
                              ),
                              y: step(
                                value.y,
                                direction === 'down'
                                  ? 0.01
                                  : direction === 'up'
                                    ? -0.01
                                    : 0,
                              ),
                            }
                          : value,
                      );
                      setAnnouncement('Comment position updated.');
                    }}
                  >
                    {direction}
                  </button>
                ))}
              </div>
            )}
            <div className="contents" inert={pending || dragging}>
              <SignComments
                key={selected?.id ?? draft?.id ?? 'draft'}
                api={composerApi}
                signId={selected?.id ?? 'draft'}
                compact={{
                  draft: !!draft,
                  readOnly:
                    !!selected?.resolved || (pending && !moving.current),
                  onSubmitted: () => undefined,
                }}
                onStateChange={(s) => {
                  state.current = s;
                  notify.current(
                    s.busy ||
                      resolving.current ||
                      moving.current ||
                      !!drag.current,
                  );
                }}
              />
            </div>
          </div>,
          host,
        )}
    </>
  );
}
