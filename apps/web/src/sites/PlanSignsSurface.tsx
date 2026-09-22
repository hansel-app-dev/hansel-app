/** @spec allocation-plan-signs REQ-001..002, REQ-005..013 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  planSignPatchSchema,
  signFunctionOptions,
  signFunctionSchema,
  type PlanSign,
  type PlanSignCreate,
  type PlanSignPatch,
} from '@hansel/contracts';
import { PlanSignRequestError, type PlanSignsApi } from './plan-signs-api.js';
import { SignDeleteDialog } from './SignDeleteDialog.js';
import { SignDocuments } from './SignDocuments.js';
import { SignPhotos } from './SignPhotos.js';
import { SignComments } from './SignComments.js';
import { SignMountingSelect } from './SignMountingSelect.js';
import { PlanToolbar, type PlanTool } from './PlanToolbar.js';
import { AddSignMenu } from './AddSignMenu.js';

const directions = [
  'left',
  'up-left',
  'up',
  'up-right',
  'right',
  'down-right',
  'down',
  'down-left',
] as const;
const arrows = ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'];
const control =
  'h-10 w-full rounded border border-[#e2e2e7] bg-white px-3 text-[14px] focus-visible:outline-2 focus-visible:outline-[#4096ff] disabled:opacity-70';

export function PlanSignsSurface({
  api,
  fileId,
  panning,
  drawerHost,
  onPanModeChange,
  viewScale,
  children,
}: {
  api: PlanSignsApi;
  fileId: string | null;
  panning: boolean;
  drawerHost: HTMLElement | null;
  onPanModeChange?: (enabled: boolean) => void;
  viewScale?: number;
  children: ReactNode;
}) {
  const service = useRef(api);
  service.current = api;
  const active = useRef(true);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [tool, setTool] = useState<PlanTool>('move');
  useEffect(() => {
    onPanModeChange?.(tool === 'hand');
    return () => { onPanModeChange?.(false); };
  }, [tool, onPanModeChange]);
  const [signs, setSigns] = useState<PlanSign[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [documentsEnabled, setDocumentsEnabled] = useState(false);
  const [photosEnabled, setPhotosEnabled] = useState(false);
  const [commentsEnabled, setCommentsEnabled] = useState(false);
  const [commentDirty, setCommentDirty] = useState(false);
  const [section, setSection] = useState('General');
  const [selected, setSelected] = useState<PlanSign | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlanSign | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteConflict, setDeleteConflict] = useState(false);
  const [code, setCode] = useState('');
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const down = useRef<{ x: number; y: number } | null>(null);
  const drawing = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<{
    x: number; y: number;
    point: { x: number; y: number };
    bounds: { left: number; top: number; right: number; bottom: number };
  } | null>(null);
  const dismissPlacement = useCallback(() => {
    setPlacement(null);
    drawing.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => { if (panning) setPlacement(null); }, [panning]);
  useEffect(() => { setPlacement(null); }, [viewScale, fileId]);
  const drag = useRef<{
    sign: PlanSign;
    pointerId: number;
    element: HTMLButtonElement;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const [preview, setPreview] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const suppressClick = useRef(false);
  const dirty =
    !!selected && (code !== selected.code || content !== selected.content);
  const unsaved = dirty || commentDirty || (!!selected && retry !== null);
  const leave = () =>
    !busy.current &&
    (!unsaved || window.confirm('Discard unsaved Sign changes?'));
  function select(sign: PlanSign | null) {
    setPlacement(null);
    if (sign?.id !== selected?.id) setSection('General');
    setSelected(sign);
    setCode(sign?.code ?? '');
    setContent(sign?.content ?? '');
    setMessage('');
    setConflict(false);
    setRetry(null);
  }
  function cancelDrag() {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    suppressClick.current = true;
    setPreview(null);
    if (current.element.hasPointerCapture(current.pointerId))
      current.element.releasePointerCapture(current.pointerId);
  }
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && drag.current) {
        event.preventDefault();
        event.stopPropagation();
        cancelDrag();
      }
    };
    window.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('keydown', escape, true);
    };
  }, []);
  useEffect(() => {
    if (panning) cancelDrag();
  }, [panning]);
  function moveSign(sign: PlanSign, x: number, y: number) {
    if (tool !== 'move' || !canManage || panning || conflict || busy.current) return;
    void mutate(
      async () => {
        const saved = await service.current.update(sign.id, {
          expectedUpdatedAt: sign.updatedAt,
          x,
          y,
        });
        if (!active.current) return;
        setSigns((current) =>
          current.map((item) => (item.id === saved.id ? saved : item)),
        );
        select(saved);
      },
      () => {
        moveSign(sign, x, y);
      },
    ).finally(() => {
      if (active.current) setPreview(null);
    });
  }
  function startMove(
    event: ReactPointerEvent<HTMLButtonElement>,
    sign: PlanSign,
  ) {
    if (panning || tool === 'hand') return;
    event.stopPropagation();
    suppressClick.current = false;
    if (
      event.button !== 0 ||
      !event.isPrimary ||
      tool !== 'move' ||
      !canManage ||
      busy.current ||
      unsaved ||
      conflict
    )
      return;
    const box = drawing.current?.getBoundingClientRect();
    if (!box?.width || !box.height) return;
    event.preventDefault();
    event.currentTarget.focus();
    setCursor(null);
    drag.current = {
      sign,
      pointerId: event.pointerId,
      element: event.currentTarget,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: (event.clientX - box.left) / box.width - sign.x,
      offsetY: (event.clientY - box.top) / box.height - sign.y,
      x: sign.x,
      y: sign.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function updateMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (panning || tool === 'hand') return;
    event.stopPropagation();
    setCursor(null);
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return;
    if (
      !current.moved &&
      Math.hypot(
        event.clientX - current.startX,
        event.clientY - current.startY,
      ) <= 3
    )
      return;
    const box = drawing.current?.getBoundingClientRect();
    if (!box?.width || !box.height) return;
    current.moved = true;
    current.x = Math.max(
      0,
      Math.min(1, (event.clientX - box.left) / box.width - current.offsetX),
    );
    current.y = Math.max(
      0,
      Math.min(1, (event.clientY - box.top) / box.height - current.offsetY),
    );
    setPreview({ id: current.sign.id, x: current.x, y: current.y });
  }
  function finishMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return;
    event.stopPropagation();
    updateMove(event);
    drag.current = null;
    if (current.element.hasPointerCapture(current.pointerId))
      current.element.releasePointerCapture(current.pointerId);
    if (current.moved) {
      suppressClick.current = true;
      moveSign(current.sign, current.x, current.y);
    }
  }
  async function load() {
    try {
      const result = await service.current.load(fileId);
      if (!active.current) return;
      setSigns(result.signs);
      setCanManage(result.canManageSigns);
      setDocumentsEnabled(result.documentsEnabled === true);
      setPhotosEnabled(result.photosEnabled === true);
      setCommentsEnabled(result.commentsEnabled === true);
      setMessage('');
      setRetry(null);
    } catch (error) {
      if (
        !active.current ||
        (error instanceof PlanSignRequestError && error.status === 404)
      )
        return;
      setMessage('We couldn’t load signs. Please try again.');
      setRetry(() => () => {
        void load();
      });
    }
  }
  useEffect(() => {
    active.current = true;
    void load();
    return () => {
      active.current = false;
    };
  }, [fileId]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (unsaved || pending) event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    const navigation = (event: MouseEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest('a[href], [role="menuitem"]')
      )
        return;
      if (
        pending ||
        (unsaved && !window.confirm('Discard unsaved Sign changes?'))
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('click', navigation, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', navigation, true);
    };
  }, [unsaved, pending]);
  async function mutate(action: () => Promise<void>, again: () => void) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage('Saving…');
    setRetry(null);
    try {
      await action();
      if (active.current) setMessage('Saved');
    } catch (error) {
      if (!active.current) return;
      const stale =
        error instanceof PlanSignRequestError && error.status === 409;
      setConflict(stale);
      setMessage(
        stale
          ? 'This sign changed. Reload before editing.'
          : 'We couldn’t save. Please try again.',
      );
      if (!stale) setRetry(() => again);
    } finally {
      busy.current = false;
      if (active.current) setPending(false);
    }
  }
  function create(input: PlanSignCreate) {
    if (tool !== 'add' || !canManage || panning || !leave()) return;
    void mutate(
      async () => {
        const sign = await service.current.create(input);
        if (!active.current) return;
        setSigns((current) => [
          ...current.filter((item) => item.id !== sign.id),
          sign,
        ]);
        select(sign);
        setTool('move');
      },
      () => {
        create(input);
      },
    );
  }
  function offerPlacement(x: number, y: number) {
    if (tool !== 'add' || !canManage || panning || !leave() || !drawing.current) return;
    const box = drawing.current.getBoundingClientRect();
    const viewport = drawing.current.closest('[data-testid="plan-pan-viewport"]')?.getBoundingClientRect();
    select(null);
    setPlacement({ x, y, point: { x: box.left + x * box.width, y: box.top + y * box.height }, bounds: {
      // Keep the file selector and bottom toolbar/zoom bands unobstructed.
      left: Math.max(0, viewport?.left ?? 0), top: Math.max(0, viewport?.top ?? 0) + 60,
      right: Math.min(window.innerWidth, viewport?.right ?? window.innerWidth), bottom: Math.min(window.innerHeight, viewport?.bottom ?? window.innerHeight) - 140,
    } });
  }
  function save(changes: Omit<PlanSignPatch, 'expectedUpdatedAt'>) {
    if (!selected || !canManage || conflict) return;
    const input = planSignPatchSchema.safeParse({
      expectedUpdatedAt: selected.updatedAt,
      ...changes,
    });
    if (!input.success) {
      setMessage(
        'Enter a code (1–40 characters) and content up to 200 characters.',
      );
      return;
    }
    const id = selected.id;
    void mutate(
      async () => {
        const sign = await service.current.update(id, input.data);
        if (!active.current) return;
        setSigns((current) =>
          current.map((item) => (item.id === sign.id ? sign : item)),
        );
        select(sign);
      },
      () => {
        save(changes);
      },
    );
  }
  const saveText = () => {
    if (dirty) save({ code, content });
  };
  async function remove() {
    if (!deleteTarget || !canManage || busy.current || deleteConflict) return;
    const sign = deleteTarget;
    busy.current = true;
    setPending(true);
    setDeleteError('');
    try {
      await service.current.remove(sign.id, sign.updatedAt);
      if (!active.current) return;
      setSigns((current) => current.filter((item) => item.id !== sign.id));
      setDeleteTarget(null);
      select(null);
      drawing.current?.focus();
    } catch (error) {
      if (!active.current) return;
      const stale =
        error instanceof PlanSignRequestError && error.status === 409;
      setDeleteConflict(stale);
      setDeleteError(
        stale
          ? 'This sign changed. Reload before deleting.'
          : 'We couldn’t delete this sign. Please try again.',
      );
    } finally {
      busy.current = false;
      if (active.current) setPending(false);
    }
  }
  const notice = (
    <div role="status" className="text-xs text-[#72727e]">
      {message}
      {retry && (
        <button type="button" onClick={retry} className="ml-2 underline">
          Retry
        </button>
      )}
      {conflict && (
        <button
          type="button"
          className="ml-2 underline"
          onClick={() => {
            if (leave()) {
              select(null);
              void load();
            }
          }}
        >
          Reload
        </button>
      )}
    </div>
  );
  const drawer =
    selected && drawerHost
      ? createPortal(
          <aside
            aria-label="Sign details"
            className="absolute -right-8 top-0 bottom-0 z-20 flex w-[350px] max-w-full flex-col overflow-hidden border-l border-[#e2e2e7] bg-white text-[#27272a] shadow-[-8px_0_20px_#00000014] max-md:right-0 max-[1050px]:bottom-[134px]"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && leave()) select(null);
            }}
          >
            <div className="shrink-0 px-6 pt-6">
              <button
                type="button"
                aria-label="Close sign details"
                disabled={pending}
                onClick={() => {
                  if (leave()) select(null);
                }}
                className="mb-4 grid size-5 place-items-center text-2xl leading-5 text-[#72727e]"
              >
                ×
              </button>
              <input
                aria-label="Sign code"
                className={`${control} !px-2 !text-[20px]`}
                readOnly={!canManage}
                disabled={pending}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                }}
                onBlur={saveText}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    saveText();
                  }
                }}
              />
            </div>
            <div
              role="tablist"
              aria-label="Sign sections"
              className="mt-3 flex h-[38px] shrink-0 gap-4 border-b border-[#e2e2e7] px-6 text-sm"
            >
              {['General', 'Docs', 'Photos', 'Comments'].map((tab, i) => (
                <button
                  key={tab}
                  role="tab"
                  type="button"
                  aria-selected={section === tab}
                  disabled={
                    pending ||
                    (i === 3 && (!commentsEnabled || !api.comments)) ||
                    (i === 1 && (!documentsEnabled || !api.documents)) ||
                    (i === 2 && (!photosEnabled || !api.photos))
                  }
                  onClick={() => {
                    if (section !== tab && leave()) setSection(tab);
                  }}
                  className={
                    section === tab ? 'border-b-[3px] border-[#27272a]' : ''
                  }
                >
                  {tab}
                </button>
              ))}
            </div>
            {section === 'Comments' && api.comments ? (
              <SignComments key={selected.id} api={api.comments} signId={selected.id}
                onStateChange={(state) => { busy.current = state.busy; setPending(state.busy); setCommentDirty(state.dirty); }} />
            ) : section === 'Photos' && api.photos ? (
              <SignPhotos
                key={selected.id}
                api={api.photos}
                signId={selected.id}
                canManage={canManage}
                onBusyChange={(value) => {
                  busy.current = value;
                  setPending(value);
                }}
              />
            ) : section === 'Docs' && api.documents ? (
              <SignDocuments
                key={selected.id}
                api={api.documents}
                signId={selected.id}
                canManage={canManage}
                onBusyChange={(value) => {
                  busy.current = value;
                  setPending(value);
                }}
              />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-5">
                <p className="text-[13px] leading-[15px] text-[#72727e]">
                  <strong>General signs attributes</strong>
                  <br />
                  Record sign type, function, content, and how it appears on the
                  plan.
                </p>
                <div className="mt-5 space-y-4 text-sm">
                  <SignMountingSelect key={selected.id} value={selected.mounting} disabled={!canManage || pending} onChange={mounting => { save({ mounting }); }} />
                  <label className="block">
                    Function
                    <select
                      className={`${control} mt-2`}
                      disabled={!canManage || pending}
                      value={selected.function}
                      onChange={(event) => {
                        save({ function: signFunctionSchema.parse(event.target.value) });
                      }}
                    >
                      {signFunctionOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    Colour
                    <span className="relative mt-2 block">
                      <span
                        aria-hidden="true"
                        className="absolute left-3 top-[10px] size-5 rounded-full bg-[#f45b00]"
                      />
                      <select
                        className={`${control} !pl-10`}
                        disabled={!canManage || pending}
                        value={selected.colour}
                        onChange={() => {
                          save({ colour: 'Red' });
                        }}
                      >
                        <option>Red</option>
                      </select>
                    </span>
                  </label>
                  <fieldset>
                    <legend>Orientation</legend>
                    <div className="mt-2 flex h-10 overflow-hidden rounded border border-[#e2e2e7]">
                      {directions.map((direction, i) => (
                        <button
                          key={direction}
                          type="button"
                          aria-label={`Orient ${direction}`}
                          aria-pressed={selected.orientation === direction}
                          disabled={!canManage || pending}
                          onClick={() => {
                            save({ orientation: direction });
                          }}
                          className={`flex-1 border-r border-[#e2e2e7] text-lg text-[#72727e] last:border-0 ${selected.orientation === direction ? 'bg-[#f4f4f5]' : 'bg-white'}`}
                        >
                          {arrows[i]}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label className="block">
                    Content
                    <textarea
                      value={content}
                      readOnly={!canManage}
                      disabled={pending}
                      onChange={(event) => {
                        setContent(event.target.value);
                      }}
                      onBlur={saveText}
                      className="mt-2 h-[120px] w-full resize-none rounded border border-[#e2e2e7] p-3 focus-visible:outline-2 focus-visible:outline-[#4096ff]"
                    />
                  </label>
                </div>
                <div className="mt-2 min-h-4">{notice}</div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!busy.current && !unsaved) {
                        setDeleteError('');
                        setDeleteConflict(false);
                        setDeleteTarget(selected);
                      }
                    }}
                    disabled={pending || unsaved}
                    className="mt-auto inline-flex items-center gap-2 self-start rounded border border-[#ff3b3b] px-2 py-[5px] text-sm text-[#ff3b3b]"
                  >
                    <svg
                      aria-hidden="true"
                      width="18"
                      height="18"
                      viewBox="0 0 18 18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    >
                      <path d="M3 5h12M7 2h4l1 2H6l1-2ZM4 5l.7 11h8.6L14 5M7 7v7M11 7v7" />
                    </svg>
                    Delete sign
                  </button>
                )}
              </div>
            )}
          </aside>,
          drawerHost,
        )
      : null;
  return (
    <>
      {drawerHost && createPortal(
        <div className="absolute -left-[14px] bottom-5 z-30 max-w-full max-md:left-0">
          <PlanToolbar tool={tool} canAdd={canManage} disabled={pending || !!preview || !!deleteTarget} onChange={next => {
            if (next === tool || drag.current || !leave()) return;
            if (unsaved) select(null);
            setCursor(null);
            setPlacement(null);
            setTool(next);
          }} />
        </div>, drawerHost,
      )}
      <div
        aria-label="Plan drawing"
        ref={drawing}
        data-can-manage-signs={canManage}
        tabIndex={canManage ? 0 : -1}
        className="relative outline-offset-2"
        style={{ cursor: canManage && !panning && tool === 'add' ? 'url("/assets/add-sign-cursor.svg") 4 4, crosshair' : undefined }}
        onPointerDown={(event) => {
          suppressClick.current = false;
          down.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          if (tool !== 'add' || !canManage || panning) return;
          const box = event.currentTarget.getBoundingClientRect();
          setCursor({
            x: (event.clientX - box.left) / box.width,
            y: (event.clientY - box.top) / box.height,
          });
        }}
        onPointerLeave={() => {
          setCursor(null);
        }}
        onClick={(event) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            event.stopPropagation();
            return;
          }
          if (
            event.button !== 0 ||
            panning ||
            busy.current ||
            (event.target instanceof Element && event.target.closest('button'))
          )
            return;
          if (
            down.current &&
            Math.hypot(
              event.clientX - down.current.x,
              event.clientY - down.current.y,
            ) > 3
          )
            return;
          const box = event.currentTarget.getBoundingClientRect();
          if (!box.width || !box.height) return;
          if (tool === 'move') {
            if (leave()) select(null);
            return;
          }
          const x = (event.clientX - box.left) / box.width,
            y = (event.clientY - box.top) / box.height;
          if (x >= 0 && x <= 1 && y >= 0 && y <= 1)
            offerPlacement(x, y);
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || !canManage || panning)
            return;
          if (event.key === 'Escape') {
            setCursor(null);
            if (leave()) select(null);
          }
          if (tool !== 'add') return;
          if (event.key.startsWith('Arrow')) {
            event.preventDefault();
            setCursor((current) => ({
              x: Math.max(
                0,
                Math.min(
                  1,
                  (current?.x ?? 0.5) +
                    (event.key === 'ArrowRight'
                      ? 0.01
                      : event.key === 'ArrowLeft'
                        ? -0.01
                        : 0),
                ),
              ),
              y: Math.max(
                0,
                Math.min(
                  1,
                  (current?.y ?? 0.5) +
                    (event.key === 'ArrowDown'
                      ? 0.01
                      : event.key === 'ArrowUp'
                        ? -0.01
                        : 0),
                ),
              ),
            }));
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            offerPlacement(cursor?.x ?? 0.5, cursor?.y ?? 0.5);
          }
        }}
      >
        {children}
        {signs.map((sign) => (
          <button
            type="button"
            key={sign.id}
            aria-label={`Select sign ${sign.code}`}
            onPointerDown={(event) => {
              startMove(event, sign);
            }}
            onPointerMove={updateMove}
            onPointerUp={finishMove}
            onPointerCancel={cancelDrag}
            onLostPointerCapture={cancelDrag}
            onDragStart={(event) => {
              event.preventDefault();
            }}
            onKeyDown={(event) => {
              if (
                !event.altKey ||
                !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
                  event.key,
                )
              )
                return;
              event.preventDefault();
              event.stopPropagation();
              if (tool !== 'move' || unsaved || busy.current || !canManage || panning || conflict)
                return;
              moveSign(
                sign,
                Math.max(
                  0,
                  Math.min(
                    1,
                    sign.x +
                      (event.key === 'ArrowRight'
                        ? 0.01
                        : event.key === 'ArrowLeft'
                          ? -0.01
                          : 0),
                  ),
                ),
                Math.max(
                  0,
                  Math.min(
                    1,
                    sign.y +
                      (event.key === 'ArrowDown'
                        ? 0.01
                        : event.key === 'ArrowUp'
                          ? -0.01
                          : 0),
                  ),
                ),
              );
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (panning || tool === 'hand') return;
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              if (leave()) select(sign);
            }}
            style={{
              left: `${String((preview?.id === sign.id ? preview.x : sign.x) * 100)}%`,
              top: `${String((preview?.id === sign.id ? preview.y : sign.y) * 100)}%`,
              cursor: panning || tool === 'hand' ? 'inherit' : tool === 'move' && canManage ? 'move' : 'pointer',
              touchAction: tool === 'move' && canManage && !panning ? 'none' : 'auto',
            }}
            className={`absolute flex h-6 -translate-x-3 -translate-y-3 items-center gap-[2px] whitespace-nowrap text-sm text-white ${selected?.id === sign.id ? 'outline outline-2 outline-offset-4 outline-dashed outline-[#4096ff]' : ''}`}
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-white bg-[#f45b00] shadow-sm">
              {arrows[directions.indexOf(sign.orientation)]}
            </span>
            <span
              className="max-w-[180px] truncate rounded-sm bg-[#f45b00] px-2 leading-6"
              title={sign.code}
            >
              {sign.code}
            </span>
          </button>
        ))}
      </div>
      {placement && drawerHost && createPortal(<AddSignMenu point={placement.point} bounds={placement.bounds} onDismiss={dismissPlacement} onChoose={mounting => {
        setPlacement(null);
        create({ x: placement.x, y: placement.y, fileId, mounting, idempotencyKey: crypto.randomUUID() });
      }} />, drawerHost)}
      {!selected &&
        message &&
        drawerHost &&
        createPortal(
          <div className="absolute bottom-20 left-2 z-20 rounded bg-white p-2 shadow">
            {notice}
          </div>,
          drawerHost,
        )}
      {drawer}
      {deleteTarget && drawerHost && (
        <SignDeleteDialog
          code={deleteTarget.code}
          host={drawerHost}
          pending={pending}
          error={deleteError}
          conflict={deleteConflict}
          onCancel={() => {
            if (!busy.current) setDeleteTarget(null);
          }}
          onConfirm={() => {
            void remove();
          }}
          onReload={() => {
            if (!busy.current) {
              setDeleteTarget(null);
              select(null);
              void load();
            }
          }}
        />
      )}
    </>
  );
}
