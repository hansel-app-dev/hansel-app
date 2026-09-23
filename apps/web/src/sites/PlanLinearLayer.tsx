/** @spec allocation-plan-add-linear REQ-002..006,010..012 */
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import type { PlanSign, PlanSignCreate } from '@hansel/contracts';
import type { PlanTool } from './PlanToolbar.js';
import { AddSignMenu } from './AddSignMenu.js';
import { planCursor } from './plan-tool-cursors.js';
import {
  clampLinear,
  linearPoint,
  linearLength,
  moveLinear,
  type LinearGeometry,
} from './linear-geometry.js';
export interface PlanLinearHandle {
  keyDown: (event: KeyboardEvent) => void;
  cancel: () => void;
}
interface Point {
  x: number;
  y: number;
}
interface Gesture {
  sign: PlanSign | null;
  kind: 'draw' | 'move' | 'start' | 'end';
  original: LinearGeometry;
  geometry: LinearGeometry;
  start: Point;
  client: Point;
  moved: boolean;
  pointerId: number;
  element: Element;
}
function geometry(sign: PlanSign): LinearGeometry {
  return {
    x: sign.x,
    y: sign.y,
    endX: sign.endX ?? sign.x,
    endY: sign.endY ?? sign.y,
  };
}
export function PlanLinearLayer({
  ref,
  signs,
  selectedId,
  tool,
  panning,
  canManage,
  blocked,
  fileId,
  viewScale,
  host,
  beforeCreate,
  onSelect,
  onCreate,
  onTransform,
}: {
  ref?: Ref<PlanLinearHandle>;
  signs: PlanSign[];
  selectedId?: string | undefined;
  tool: PlanTool;
  panning: boolean;
  canManage: boolean;
  blocked: boolean;
  fileId: string | null;
  viewScale?: number | undefined;
  host: HTMLElement | null;
  beforeCreate: () => boolean;
  onSelect: (sign: PlanSign) => boolean;
  onCreate: (input: PlanSignCreate) => void;
  onTransform: (sign: PlanSign, geometry: LinearGeometry) => Promise<void>;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const suppress = useRef(false);
  const [armed, setArmed] = useState(false);
  const [cursor, setCursor] = useState<Point>({ x: 0.5, y: 0.5 });
  const [start, setStart] = useState<Point | null>(null);
  const [preview, setPreview] = useState<{
    id?: string | undefined;
    line: LinearGeometry;
  } | null>(null);
  const [editing, setEditing] = useState<{
    sign: PlanSign;
    end: 'start' | 'end';
    line: LinearGeometry;
  } | null>(null);
  const [menu, setMenu] = useState<{
    point: Point;
    bounds: { left: number; top: number; right: number; bottom: number };
  } | null>(null);
  const cancel = useCallback(() => {
    const old = gesture.current;
    gesture.current = null;
    if (old) {
      suppress.current = true;
      if (old.element.hasPointerCapture(old.pointerId))
        old.element.releasePointerCapture(old.pointerId);
    }
    setPreview(null);
    setEditing(null);
    setStart(null);
    setArmed(false);
    setMenu(null);
  }, []);
  useEffect(() => {
    cancel();
  }, [tool, panning, fileId, viewScale, canManage, cancel]);
  useEffect(() => {
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancel();
      }
    };
    window.addEventListener('blur', cancel);
    window.addEventListener('resize', cancel);
    window.addEventListener('keydown', escape, true);
    const scroll = (event: Event) => {
      if (
        event.target instanceof Element &&
        event.target.closest('[role="menu"]')
      )
        return;
      cancel();
    };
    document.addEventListener('scroll', scroll, true);
    return () => {
      window.removeEventListener('blur', cancel);
      window.removeEventListener('resize', cancel);
      window.removeEventListener('keydown', escape, true);
      document.removeEventListener('scroll', scroll, true);
    };
  }, [cancel]);
  const dismiss = useCallback(() => {
    setMenu(null);
    canvas.current?.focus({ preventScroll: true });
  }, []);
  function offer(point: Point) {
    if (tool !== 'line' || !canManage || panning || blocked || !beforeCreate())
      return;
    const box = canvas.current?.getBoundingClientRect();
    if (!box?.width || !box.height) return;
    const viewport = canvas.current
      ?.closest('[data-testid="plan-pan-viewport"]')
      ?.getBoundingClientRect();
    setCursor(point);
    setMenu({
      point: {
        x: box.left + point.x * box.width,
        y: box.top + point.y * box.height,
      },
      bounds: {
        left: Math.max(0, viewport?.left ?? 0),
        top: Math.max(0, viewport?.top ?? 0) + 60,
        right: Math.min(
          window.innerWidth,
          viewport?.right ?? window.innerWidth,
        ),
        bottom:
          Math.min(window.innerHeight, viewport?.bottom ?? window.innerHeight) -
          140,
      },
    });
  }
  function submit(line: LinearGeometry) {
    const box = canvas.current?.getBoundingClientRect();
    if (!box || linearLength(line, box) < 4) return;
    setArmed(false);
    setStart(null);
    setPreview(null);
    onCreate({
      ...line,
      fileId,
      placementKind: 'linear',
      mounting: 'Safety Decal',
      idempotencyKey: crypto.randomUUID(),
    });
  }
  function keyDown(event: KeyboardEvent) {
    if (tool !== 'line' || !canManage || panning || blocked) return;
    if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      event.stopPropagation();
      const next = arrow(cursor, event.key);
      setCursor(next);
      if (start) setPreview({ line: { ...start, endX: next.x, endY: next.y } });
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      if (!armed) offer(cursor);
      else if (!start) setStart(cursor);
      else submit({ ...start, endX: cursor.x, endY: cursor.y });
    }
  }
  useImperativeHandle(ref, () => ({ keyDown, cancel }));
  function begin(
    event: PointerEvent,
    sign: PlanSign | null,
    kind: Gesture['kind'],
  ) {
    if (panning || tool === 'hand') return;
    event.stopPropagation();
    suppress.current = false;
    if (event.button !== 0 || !event.isPrimary || !canManage || blocked) return;
    if (sign && tool !== 'move') return;
    if (!sign && (tool !== 'line' || !armed)) return;
    const box = canvas.current?.getBoundingClientRect();
    if (!box?.width || !box.height) return;
    if (sign && !onSelect(sign)) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).focus({ preventScroll: true });
    const point = linearPoint(event.clientX, event.clientY, box);
    const line = sign
      ? geometry(sign)
      : { ...point, endX: point.x, endY: point.y };
    gesture.current = {
      sign,
      kind,
      original: line,
      geometry: line,
      start: point,
      client: { x: event.clientX, y: event.clientY },
      moved: false,
      pointerId: event.pointerId,
      element: event.currentTarget,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPreview({ id: sign?.id, line });
  }
  function motion(event: PointerEvent) {
    const current = gesture.current;
    if (current?.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const box = canvas.current?.getBoundingClientRect();
    if (!box?.width || !box.height) return;
    const point = linearPoint(event.clientX, event.clientY, box);
    current.moved ||=
      Math.hypot(
        event.clientX - current.client.x,
        event.clientY - current.client.y,
      ) > 3;
    current.geometry =
      current.kind === 'move'
        ? moveLinear(
            current.original,
            point.x - current.start.x,
            point.y - current.start.y,
          )
        : current.kind === 'start'
          ? { ...current.original, ...point }
          : { ...current.original, endX: point.x, endY: point.y };
    setPreview({ id: current.sign?.id, line: current.geometry });
  }
  function finish(event: PointerEvent) {
    const current = gesture.current;
    if (current?.pointerId !== event.pointerId) return;
    event.stopPropagation();
    motion(event);
    gesture.current = null;
    suppress.current = true;
    if (current.element.hasPointerCapture(current.pointerId))
      current.element.releasePointerCapture(current.pointerId);
    setPreview(null);
    const box = canvas.current?.getBoundingClientRect();
    if (!box || linearLength(current.geometry, box) < 4) return;
    if (current.kind === 'draw') submit(current.geometry);
    else if (
      current.sign &&
      current.moved &&
      !same(current.original, current.geometry)
    )
      void onTransform(current.sign, current.geometry);
  }
  function choose(event: React.MouseEvent, sign: PlanSign) {
    if (panning || tool === 'hand') return;
    event.stopPropagation();
    if (suppress.current) {
      suppress.current = false;
      return;
    }
    if (!blocked) onSelect(sign);
  }
  function translate(event: KeyboardEvent, sign: PlanSign) {
    if (
      !event.altKey ||
      !event.key.startsWith('Arrow') ||
      tool !== 'move' ||
      !canManage ||
      panning ||
      blocked
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    if (!onSelect(sign)) return;
    const delta = arrow({ x: 0.5, y: 0.5 }, event.key);
    const next = moveLinear(geometry(sign), delta.x - 0.5, delta.y - 0.5);
    if (!same(geometry(sign), next)) void onTransform(sign, next);
  }
  function handleKey(
    event: KeyboardEvent,
    sign: PlanSign,
    end: 'start' | 'end',
  ) {
    if (!canManage || panning || blocked || tool !== 'move') return;
    event.stopPropagation();
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!editing) {
        setEditing({ sign, end, line: geometry(sign) });
        return;
      }
      const box = canvas.current?.getBoundingClientRect();
      if (box && linearLength(editing.line, box) >= 4) {
        setEditing(null);
        setPreview(null);
        if (!same(geometry(sign), editing.line)) {
          const element = event.currentTarget as HTMLElement;
          void onTransform(sign, editing.line).finally(() => {
            requestAnimationFrame(() => {
              if (
                element.isConnected &&
                document.activeElement === document.body
              )
                element.focus({ preventScroll: true });
            });
          });
        }
      }
    } else if (event.key.startsWith('Arrow') && editing) {
      event.preventDefault();
      const point = arrow(
        end === 'start'
          ? { x: editing.line.x, y: editing.line.y }
          : { x: editing.line.endX, y: editing.line.endY },
        event.key,
      );
      const line =
        end === 'start'
          ? { ...editing.line, ...point }
          : { ...editing.line, endX: point.x, endY: point.y };
      setEditing({ ...editing, line });
      setPreview({ id: sign.id, line });
    }
  }
  const cursorStyle =
    panning || tool === 'hand' || canManage
      ? planCursor(tool, panning)
      : 'pointer';
  return (
    <>
      <div
        ref={canvas}
        aria-label="Linear drawing"
        tabIndex={tool === 'line' && canManage ? 0 : -1}
        className="pointer-events-none absolute inset-0 z-[8] outline-offset-2"
        style={{
          pointerEvents: tool === 'line' && !panning ? 'auto' : 'none',
          touchAction: tool === 'line' && !panning ? 'none' : 'auto',
          cursor: cursorStyle,
        }}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget) keyDown(event);
        }}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) begin(event, null, 'draw');
        }}
        onPointerMove={motion}
        onPointerUp={finish}
        onPointerCancel={cancel}
        onLostPointerCapture={() => {
          if (gesture.current) cancel();
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          event.stopPropagation();
          if (suppress.current) {
            suppress.current = false;
            return;
          }
          if (armed) return;
          const box = event.currentTarget.getBoundingClientRect();
          offer(linearPoint(event.clientX, event.clientY, box));
        }}
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          aria-label="Linear signs"
        >
          {signs.map((sign) => {
            const line =
              preview?.id === sign.id ? preview.line : geometry(sign);
            return (
              <g key={sign.id}>
                <line
                  {...svgLine(line)}
                  stroke="#ff7a00"
                  strokeWidth="2"
                  strokeDasharray="5 3"
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  {...svgLine(line)}
                  stroke="transparent"
                  strokeWidth="20"
                  vectorEffect="non-scaling-stroke"
                  style={{
                    pointerEvents: 'stroke',
                    cursor: cursorStyle,
                    touchAction: tool === 'move' && !panning ? 'none' : 'auto',
                  }}
                  role="button"
                  className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4096ff]"
                  tabIndex={0}
                  aria-label={`Move sign ${sign.code}`}
                  onClick={(event) => {
                    choose(event, sign);
                  }}
                  onKeyDown={(event) => {
                    translate(event, sign);
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      if (!blocked && !panning && tool !== 'hand')
                        onSelect(sign);
                    }
                  }}
                  onPointerDown={(event) => {
                    begin(event, sign, 'move');
                  }}
                />
              </g>
            );
          })}
          {preview && !preview.id && (
            <line
              {...svgLine(preview.line)}
              stroke="#ff7a00"
              strokeWidth="2"
              strokeDasharray="5 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {signs.map((sign) => {
          const line = preview?.id === sign.id ? preview.line : geometry(sign);
          return (
            <div key={sign.id}>
              <button
                type="button"
                aria-label={`Select sign ${sign.code}`}
                title={sign.code}
                className="pointer-events-auto absolute max-w-[180px] truncate rounded-sm bg-[#ff7a00] px-2 text-sm leading-6 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4096ff]"
                style={{
                  maxWidth: 'min(180px, 20%)',
                  left: `${String(line.x * 100)}%`,
                  top: `${String(line.y * 100)}%`,
                  transform: `translate(${line.x > 0.8 ? '-100%' : '0'},${line.y > 0.9 || (line.endY > line.y && line.y > 0.05) ? 'calc(-100% - 5px)' : '5px'})`,
                  cursor: cursorStyle,
                  touchAction: tool === 'move' && !panning ? 'none' : 'auto',
                }}
                onClick={(event) => {
                  choose(event, sign);
                }}
                onKeyDown={(event) => {
                  translate(event, sign);
                }}
                onPointerDown={(event) => {
                  begin(event, sign, 'move');
                }}
              >
                {sign.code}
              </button>
              {selectedId === sign.id &&
                canManage &&
                tool === 'move' &&
                !panning &&
                (['start', 'end'] as const).map((end) => (
                  <button
                    key={end}
                    type="button"
                    aria-label={`Resize ${sign.code} ${end} endpoint`}
                    aria-pressed={
                      editing?.sign.id === sign.id && editing.end === end
                    }
                    disabled={blocked}
                    className="pointer-events-auto absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center focus-visible:outline-2 focus-visible:outline-[#4096ff]"
                    style={{
                      left: `${String((end === 'start' ? line.x : line.endX) * 100)}%`,
                      top: `${String((end === 'start' ? line.y : line.endY) * 100)}%`,
                      cursor: 'crosshair',
                      touchAction: 'none',
                    }}
                    onPointerDown={(event) => {
                      begin(event, sign, end);
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                    onKeyDown={(event) => {
                      handleKey(event, sign, end);
                    }}
                    onBlur={() => {
                      if (editing) {
                        setEditing(null);
                        setPreview(null);
                      }
                    }}
                  >
                    <span className="size-2 border border-[#ff7a00] bg-white" />
                  </button>
                ))}
            </div>
          );
        })}
      </div>
      {menu &&
        host &&
        createPortal(
          <AddSignMenu
            kind="line"
            {...menu}
            onDismiss={dismiss}
            onChoose={() => {
              setMenu(null);
              setArmed(true);
              setStart(null);
              canvas.current?.focus({ preventScroll: true });
            }}
          />,
          host,
        )}
      {armed &&
        host &&
        createPortal(
          <div
            role="status"
            className="absolute bottom-20 left-2 z-20 rounded bg-white p-2 text-xs shadow"
          >
            {start
              ? 'Choose the end with arrow keys, then press Enter.'
              : 'Drag to draw a Linear Sign, or use arrows and Enter to set each endpoint.'}
          </div>,
          host,
        )}
    </>
  );
}
function svgLine(line: LinearGeometry) {
  return { x1: line.x, y1: line.y, x2: line.endX, y2: line.endY };
}
function same(a: LinearGeometry, b: LinearGeometry) {
  return a.x === b.x && a.y === b.y && a.endX === b.endX && a.endY === b.endY;
}
function arrow(point: Point, key: string): Point {
  return {
    x: clampLinear(
      point.x + (key === 'ArrowRight' ? 0.01 : key === 'ArrowLeft' ? -0.01 : 0),
    ),
    y: clampLinear(
      point.y + (key === 'ArrowDown' ? 0.01 : key === 'ArrowUp' ? -0.01 : 0),
    ),
  };
}
