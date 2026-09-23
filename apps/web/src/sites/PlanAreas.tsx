/** @spec allocation-plan-add-area REQ-001..REQ-012 */
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  planAreaPatchSchema,
  type PlanArea,
  type PlanAreaCreate,
  type PlanAreaPatch,
} from '@hansel/contracts';
import { PlanAreaRequestError, type PlanAreasApi } from './plan-areas-api.js';
import { AddSignMenu } from './AddSignMenu.js';
import { AreaDetails } from './AreaDetails.js';
import {
  areaPoint,
  areaRectangle,
  moveArea,
  clampAreaCoordinate,
  type AreaPoint,
} from './area-geometry.js';
import type { PlanTool } from './PlanToolbar.js';
export interface PlanAreasHandle {
  leave: () => boolean;
  clear: () => void;
  blocked: () => boolean;
  keyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}
interface Gesture {
  pointerId: number;
  element: HTMLElement;
  start: AreaPoint;
  last: AreaPoint;
  client: AreaPoint;
  area: PlanArea | null;
  moved: boolean;
}
export function PlanAreas({
  api,
  fileId,
  tool,
  panning,
  externalBusy,
  drawerHost,
  viewScale,
  beforeSelect,
  onBusyChange,
  ref,
}: {
  api: PlanAreasApi;
  fileId: string | null;
  tool: PlanTool;
  panning: boolean;
  externalBusy: boolean;
  drawerHost: HTMLElement | null;
  viewScale?: number | undefined;
  beforeSelect: () => boolean;
  onBusyChange: (busy: boolean) => void;
  ref?: Ref<PlanAreasHandle>;
}) {
  const [areas, setAreas] = useState<PlanArea[]>([]),
    [canManage, setCanManage] = useState(false),
    [selected, setSelected] = useState<PlanArea | null>(null),
    [code, setCode] = useState(''),
    [content, setContent] = useState('');
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(''),
    [conflict, setConflict] = useState(false),
    [retry, setRetry] = useState<(() => void) | null>(null);
  const [armed, setArmed] = useState(false),
    [cursor, setCursor] = useState<AreaPoint>({ x: 0.5, y: 0.5 }),
    [corner, setCorner] = useState<AreaPoint | null>(null),
    [preview, setPreview] = useState<ReturnType<typeof areaRectangle> | null>(
      null,
    ),
    [moving, setMoving] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    point: AreaPoint;
    bounds: { left: number; top: number; right: number; bottom: number };
  } | null>(null);
  const canvas = useRef<HTMLDivElement>(null),
    gesture = useRef<Gesture | null>(null),
    busy = useRef(false),
    epoch = useRef(0),
    suppress = useRef(false),
    keyboardCreate = useRef(false);
  const placementVersion = useRef(0);
  const dirty =
    !!selected && (code !== selected.code || content !== selected.content);
  function clear() {
    setSelected(null);
    setCode('');
    setContent('');
    setRetry(null);
    setConflict(false);
    setMessage('');
  }
  function leave() {
    if (busy.current || externalBusy) return false;
    if ((dirty || retry) && !window.confirm('Discard unsaved Area changes?'))
      return false;
    if (dirty || retry) clear();
    return true;
  }
  function choose(area: PlanArea) {
    setSelected(area);
    setCode(area.code);
    setContent(area.content);
    setMessage('');
    setRetry(null);
    setConflict(false);
  }
  const cancel = useCallback(() => {
    placementVersion.current++;
    const g = gesture.current;
    gesture.current = null;
    if (g?.element.hasPointerCapture(g.pointerId))
      g.element.releasePointerCapture(g.pointerId);
    if (g) suppress.current = true;
    setPreview(null);
    setMoving(null);
    setCorner(null);
    setArmed(false);
    setMenu(null);
  }, []);
  const dismiss = useCallback(() => {
    setMenu(null);
    canvas.current?.focus({ preventScroll: true });
  }, []);
  async function load() {
    const version = epoch.current;
    try {
      const result = await api.load(fileId);
      if (version !== epoch.current) return;
      setAreas(result.areas);
      setCanManage(result.canManageAreas);
      setRetry(null);
      setConflict(false);
      setMessage('');
    } catch {
      if (version !== epoch.current) return;
      setCanManage(false);
      setMessage('We couldn’t load areas. Please try again.');
      setRetry(() => () => {
        void load();
      });
    }
  }
  useEffect(() => {
    epoch.current++;
    void load();
    return () => {
      epoch.current++;
    };
  }, [api, fileId]);
  useEffect(() => {
    onBusyChange(pending);
    return () => {
      onBusyChange(false);
    };
  }, [pending, onBusyChange]);
  useEffect(() => {
    cancel();
  }, [tool, panning, viewScale, fileId, canManage, cancel]);
  useEffect(() => {
    if (tool === 'area' && canManage)
      canvas.current?.focus({ preventScroll: true });
  }, [tool, canManage]);
  useEffect(() => {
    const dismissGesture = () => {
      cancel();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (gesture.current || armed || corner)) {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      }
    };
    const scroll = () => {
      if (gesture.current) cancel();
    };
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('blur', dismissGesture);
    window.addEventListener('resize', dismissGesture);
    window.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('blur', dismissGesture);
      window.removeEventListener('resize', dismissGesture);
      window.removeEventListener('keydown', escape, true);
    };
  }, [armed, corner, cancel]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty || pending || retry) e.preventDefault();
    };
    const navigation = (e: MouseEvent) => {
      if (
        e.target instanceof Element &&
        e.target.closest('a[href], [role="menuitem"]') &&
        !leave()
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigation, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', navigation, true);
    };
  }, [dirty, pending, retry, externalBusy]);
  async function mutate(action: () => Promise<void>, again: () => void) {
    if (busy.current || externalBusy || !canManage || conflict) return;
    const version = epoch.current;
    busy.current = true;
    setPending(true);
    setMessage('Saving…');
    setRetry(null);
    try {
      await action();
      if (version === epoch.current) setMessage('Saved');
    } catch (error) {
      if (version !== epoch.current) return;
      const stale =
        error instanceof PlanAreaRequestError && error.status === 409;
      setConflict(stale);
      setMessage(
        stale
          ? 'This area changed. Reload before editing.'
          : 'We couldn’t save this area. Please try again.',
      );
      if (!stale) setRetry(() => again);
    } finally {
      busy.current = false;
      if (version === epoch.current) {
        setPending(false);
        setPreview(null);
        setMoving(null);
      }
    }
  }
  function create(input: PlanAreaCreate) {
    const version = epoch.current;
    void mutate(
      async () => {
        const area = await api.create(input);
        if (version !== epoch.current) return;
        setAreas((current) => [
          ...current.filter((a) => a.id !== area.id),
          area,
        ]);
        choose(area);
        if (keyboardCreate.current)
          requestAnimationFrame(() => {
            document
              .getElementById(`area-${area.id}`)
              ?.focus({ preventScroll: true });
          });
      },
      () => {
        create(input);
      },
    );
  }
  function update(
    area: PlanArea,
    changes: Omit<PlanAreaPatch, 'expectedUpdatedAt'>,
  ) {
    const input = planAreaPatchSchema.safeParse({
      expectedUpdatedAt: area.updatedAt,
      ...changes,
    });
    if (!input.success) {
      setMessage(
        'Enter a code (1–40 characters) and content up to 200 characters.',
      );
      return;
    }
    const version = epoch.current;
    void mutate(
      async () => {
        const saved = await api.update(area.id, input.data);
        if (version !== epoch.current) return;
        setAreas((current) =>
          current.map((a) => (a.id === saved.id ? saved : a)),
        );
        choose(saved);
      },
      () => {
        update(area, changes);
      },
    );
  }
  function remove(area: PlanArea) {
    const version = epoch.current;
    void mutate(
      async () => {
        await api.remove(area.id, area.updatedAt);
        if (version !== epoch.current) return;
        setAreas((current) => current.filter((a) => a.id !== area.id));
        clear();
        canvas.current?.focus();
      },
      () => {
        remove(area);
      },
    );
  }
  function offer(point: AreaPoint, keyboard = false, positioned = false) {
    if (
      tool !== 'area' ||
      !canManage ||
      panning ||
      busy.current ||
      externalBusy ||
      !leave() ||
      !beforeSelect()
    )
      return;
    const box = canvas.current?.getBoundingClientRect();
    if (!box?.width || !box.height) return;
    if (
      !positioned &&
      (box.top > window.innerHeight - 180 || box.bottom < 180)
    ) {
      const version = ++placementVersion.current;
      canvas.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
      requestAnimationFrame(() => {
        if (version === placementVersion.current) offer(point, keyboard, true);
      });
      return;
    }
    clear();
    setCursor(point);
    keyboardCreate.current = keyboard;
    setMenu({
      point: {
        x: box.left + point.x * box.width,
        y: box.top + point.y * box.height,
      },
      bounds: {
        left: Math.max(8, box.left),
        top: Math.max(8, box.top),
        right: Math.min(window.innerWidth - 8, box.right),
        bottom: Math.min(window.innerHeight - 80, box.bottom),
      },
    });
  }
  function point(e: { clientX: number; clientY: number }) {
    const box = canvas.current?.getBoundingClientRect();
    return box?.width && box.height
      ? areaPoint(e.clientX, e.clientY, box)
      : null;
  }
  function begin(e: ReactPointerEvent<HTMLElement>, area: PlanArea | null) {
    if (panning || tool === 'hand') return;
    e.stopPropagation();
    if (
      e.button !== 0 ||
      !e.isPrimary ||
      !canManage ||
      busy.current ||
      externalBusy ||
      conflict ||
      (area ? tool !== 'move' : !armed) ||
      !leave() ||
      !beforeSelect()
    )
      return;
    const at = point(e);
    if (!at) return;
    e.preventDefault();
    suppress.current = false;
    gesture.current = {
      pointerId: e.pointerId,
      element: e.currentTarget,
      start: at,
      last: at,
      client: { x: e.clientX, y: e.clientY },
      area,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setMoving(area?.id ?? null);
    if (!area) {
      setCorner(null);
      setPreview(areaRectangle(at, at));
      keyboardCreate.current = false;
    }
  }
  function move(e: ReactPointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (g?.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const at = point(e);
    if (!at) return;
    g.last = at;
    g.moved ||= Math.hypot(e.clientX - g.client.x, e.clientY - g.client.y) > 3;
    if (g.area) {
      const next = moveArea(
        g.area,
        g.area.x + at.x - g.start.x,
        g.area.y + at.y - g.start.y,
      );
      setPreview({ ...g.area, ...next });
    } else setPreview(areaRectangle(g.start, at));
  }
  function finish(e: ReactPointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (g?.pointerId !== e.pointerId) return;
    e.stopPropagation();
    move(e);
    gesture.current = null;
    if (g.element.hasPointerCapture(g.pointerId))
      g.element.releasePointerCapture(g.pointerId);
    const box = canvas.current?.getBoundingClientRect();
    suppress.current = !g.area || g.moved;
    setPreview(null);
    setMoving(null);
    if (g.area) {
      if (g.moved) {
        const next = moveArea(
          g.area,
          g.area.x + g.last.x - g.start.x,
          g.area.y + g.last.y - g.start.y,
        );
        update(g.area, next);
      }
      return;
    }
    if (!box) return;
    const rect = areaRectangle(g.start, g.last);
    if (rect.width * box.width < 4 || rect.height * box.height < 4) return;
    setArmed(false);
    create({ ...rect, fileId, idempotencyKey: crypto.randomUUID() });
  }
  function keyDown(e: ReactKeyboardEvent<HTMLElement>) {
    if (
      tool !== 'area' ||
      !canManage ||
      panning ||
      busy.current ||
      externalBusy
    )
      return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancel();
      return;
    }
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      e.stopPropagation();
      const next = {
        x: clampAreaCoordinate(
          cursor.x +
            (e.key === 'ArrowRight' ? 0.01 : e.key === 'ArrowLeft' ? -0.01 : 0),
        ),
        y: clampAreaCoordinate(
          cursor.y +
            (e.key === 'ArrowDown' ? 0.01 : e.key === 'ArrowUp' ? -0.01 : 0),
        ),
      };
      setCursor(next);
      if (corner) setPreview(areaRectangle(corner, next));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (!armed) offer(cursor, true);
      else if (!corner) {
        setCorner(cursor);
        setPreview(areaRectangle(cursor, cursor));
      } else {
        const rect = areaRectangle(corner, cursor);
        if (!rect.width || !rect.height) return;
        setArmed(false);
        setCorner(null);
        setPreview(null);
        keyboardCreate.current = true;
        create({ ...rect, fileId, idempotencyKey: crypto.randomUUID() });
      }
    }
  }
  useImperativeHandle(ref, () => ({
    leave,
    clear: () => {
      clear();
      cancel();
    },
    blocked: () => busy.current || dirty || !!retry,
    keyDown,
  }));
  const notice = (
    <div role="status" className="text-xs text-[#72727e]">
      {message}
      {retry && (
        <button type="button" className="ml-2 underline" onClick={retry}>
          Retry area
        </button>
      )}
      {conflict && (
        <button
          type="button"
          className="ml-2 underline"
          onClick={() => {
            if (leave()) {
              clear();
              void load();
            }
          }}
        >
          Reload areas
        </button>
      )}
    </div>
  );
  const shape = (a: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => ({
    left: `${String(a.x * 100)}%`,
    top: `${String(a.y * 100)}%`,
    width: `${String(a.width * 100)}%`,
    height: `${String(a.height * 100)}%`,
  });
  return (
    <>
      <div
        ref={canvas}
        aria-label="Area drawing"
        tabIndex={tool === 'area' && canManage ? 0 : -1}
        className={`absolute inset-0 outline-offset-2 ${tool === 'area' && canManage && !panning && !externalBusy ? 'pointer-events-auto' : 'pointer-events-none'}`}
        style={{
          cursor: tool === 'area' && !panning ? 'crosshair' : undefined,
          touchAction: armed ? 'none' : undefined,
        }}
        onPointerDown={(e) => {
          begin(e, null);
        }}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={cancel}
        onLostPointerCapture={() => {
          if (gesture.current) cancel();
        }}
        onClick={(e) => {
          if (panning || tool === 'hand') return;
          e.stopPropagation();
          if (suppress.current) {
            suppress.current = false;
            return;
          }
          if (armed) return;
          const at = point(e);
          if (at) offer(at);
        }}
        onKeyDown={keyDown}
      >
        {areas.map((a) => {
          const rect = moving === a.id && preview ? preview : a;
          return (
            <button
              id={`area-${a.id}`}
              key={a.id}
              type="button"
              aria-label={`Select area ${a.code}`}
              className="pointer-events-auto absolute border border-dashed border-[#4096ff] bg-[#4096ff]/[0.28] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4096ff]"
              style={{
                ...shape(rect),
                cursor:
                  panning || tool === 'hand'
                    ? 'inherit'
                    : tool === 'move' && canManage
                      ? 'move'
                      : 'pointer',
                touchAction:
                  tool === 'move' && canManage && !panning ? 'none' : 'auto',
              }}
              onPointerDown={(e) => {
                begin(e, a);
              }}
              onPointerMove={move}
              onPointerUp={finish}
              onPointerCancel={cancel}
              onLostPointerCapture={() => {
                if (gesture.current) cancel();
              }}
              onDragStart={(e) => {
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (panning || tool === 'hand') return;
                if (suppress.current) {
                  suppress.current = false;
                  return;
                }
                if (leave() && beforeSelect()) {
                  cancel();
                  choose(a);
                }
              }}
              onKeyDown={(e) => {
                if (
                  e.altKey &&
                  ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
                    e.key,
                  )
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (
                    tool === 'move' &&
                    canManage &&
                    !panning &&
                    !busy.current &&
                    !externalBusy &&
                    !dirty &&
                    !conflict &&
                    beforeSelect()
                  )
                    update(
                      a,
                      moveArea(
                        a,
                        a.x +
                          (e.key === 'ArrowRight'
                            ? 0.01
                            : e.key === 'ArrowLeft'
                              ? -0.01
                              : 0),
                        a.y +
                          (e.key === 'ArrowDown'
                            ? 0.01
                            : e.key === 'ArrowUp'
                              ? -0.01
                              : 0),
                      ),
                    );
                } else e.stopPropagation();
              }}
            >
              <span
                className="absolute top-0 max-w-[180px] truncate whitespace-nowrap rounded-sm bg-[#1677cc] px-2 text-sm leading-6 text-white"
                style={
                  rect.x + rect.width > 0.85
                    ? { right: 0, top: 'auto', bottom: '100%' }
                    : { left: '100%' }
                }
                title={a.code}
              >
                {a.code}
              </span>
            </button>
          );
        })}
        {(armed || menu) && !corner && !preview && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute size-4 -translate-x-2 -translate-y-2 border border-dashed border-[#4096ff]"
            style={{
              left: `${String(cursor.x * 100)}%`,
              top: `${String(cursor.y * 100)}%`,
            }}
          />
        )}
        {preview && !moving && (
          <div
            aria-label="Area preview"
            className="pointer-events-none absolute border border-dashed border-[#4096ff] bg-[#4096ff]/[0.28]"
            style={shape(preview)}
          />
        )}
      </div>
      {menu &&
        drawerHost &&
        createPortal(
          <AddSignMenu
            kind="area"
            point={menu.point}
            bounds={menu.bounds}
            onDismiss={dismiss}
            onChoose={() => {
              setMenu(null);
              setArmed(true);
              setMessage(
                'Drag to draw a rectangle, or use arrows and Enter to set two corners. Escape cancels.',
              );
              canvas.current?.focus({ preventScroll: true });
            }}
          />,
          drawerHost,
        )}
      {selected &&
        drawerHost &&
        createPortal(
          <AreaDetails
            area={selected}
            canManage={canManage}
            pending={pending || externalBusy}
            code={code}
            content={content}
            onCode={setCode}
            onContent={setContent}
            onSaveText={() => {
              if (dirty && !busy.current && canManage)
                update(selected, { code, content });
            }}
            onOrientation={(orientation) => {
              update(selected, { orientation });
            }}
            onClose={() => {
              if (leave()) {
                clear();
                canvas.current?.focus();
              }
            }}
            onDelete={() => {
              if (
                !busy.current &&
                !conflict &&
                window.confirm(`Delete area ${selected.code}?`)
              )
                remove(selected);
            }}
            notice={notice}
          />,
          drawerHost,
        )}
      {!selected &&
        drawerHost &&
        (message || armed) &&
        createPortal(
          <div className="absolute bottom-20 left-2 z-20 max-w-[280px] rounded bg-white p-2 shadow">
            {notice}
          </div>,
          drawerHost,
        )}
    </>
  );
}
