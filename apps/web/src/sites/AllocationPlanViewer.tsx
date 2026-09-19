/** @spec site-allocation-plan-preview REQ-005..REQ-013 @figma supplied 03.png */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { AllocationPlan } from '@hansel/contracts';
import { AppSymbol } from '../application-shell/ApplicationShell.js';
import { PlanSignsSurface } from './PlanSignsSurface.js';
import type { PlanSignsApi } from './plan-signs-api.js';

export interface RenderedPlan {
  src: string;
  release(): void;
}

export async function renderPlan(
  blob: Blob,
  signal?: AbortSignal,
): Promise<RenderedPlan> {
  signal?.throwIfAborted();
  if (blob.type !== 'application/pdf') {
    const src = URL.createObjectURL(blob);
    return {
      src,
      release: () => {
        URL.revokeObjectURL(src);
      },
    };
  }
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  signal?.throwIfAborted();
  const task = pdfjs.getDocument({
    data: await blob.arrayBuffer(),
    isEvalSupported: false,
  });
  const abort = () => {
    void task.destroy();
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    signal?.throwIfAborted();
    const document = await task.promise;
    const page = await document.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('allocation_plan_preview_failed');
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const rendered = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) resolve(value);
        else reject(new Error('allocation_plan_preview_failed'));
      }, 'image/png');
    });
    const src = URL.createObjectURL(rendered);
    return {
      src,
      release: () => {
        URL.revokeObjectURL(src);
      },
    };
  } finally {
    signal?.removeEventListener('abort', abort);
    await task.destroy();
  }
}

function scrollWithinPlan(element: HTMLDivElement, x: number, y: number) {
  element.scrollLeft = Math.max(0, Math.min(x, element.scrollWidth - element.clientWidth));
  element.scrollTop = Math.max(0, Math.min(y, element.scrollHeight - element.clientHeight));
}

export function AllocationPlanViewer({
  plan,
  loadContent,
  planSignsApi,
  render = renderPlan,
}: {
  plan: AllocationPlan;
  planSignsApi?: PlanSignsApi | undefined;
  loadContent: (fileId?: string, signal?: AbortSignal) => Promise<Blob>;
  render?: (blob: Blob, signal?: AbortSignal) => Promise<RenderedPlan>;
}) {
  const [selectedId, setSelectedId] = useState(plan.files?.[0]?.id);
  const [drawerHost, setDrawerHost] = useState<HTMLElement | null>(null);
  const selected = plan.files?.find((file) => file.id === selectedId);
  const filename = selected?.filename ?? plan.filename ?? plan.name ?? 'Plan';
  const [menuOpen, setMenuOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const selector = useRef<HTMLDivElement>(null);
  const selectorButton = useRef<HTMLButtonElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(100);
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'failed' }
    | ({ status: 'ready' } & RenderedPlan)
  >({ status: 'loading' });
  const [pointerInside, setPointerInside] = useState(false);
  const [spaceArmed, setSpaceArmed] = useState(false);
  const [handActive, setHandActive] = useState(false);
  const panEnabled = spaceArmed || handActive;
  const suppressPanClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const pendingCenter = useRef<{ x: number; y: number } | undefined>(undefined);
  const drag = useRef<
    | {
        pointerId: number;
        element: HTMLDivElement;
        clientX: number;
        clientY: number;
        scrollLeft: number;
        scrollTop: number;
      }
    | undefined
  >(undefined);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let rendered: RenderedPlan | undefined;
    setState({ status: 'loading' });
    setZoom(100);
    setImageSize({ width: 0, height: 0 });
    void loadContent(selectedId, controller.signal)
      .then((blob) => {
        controller.signal.throwIfAborted();
        return render(blob, controller.signal);
      })
      .then((value) => {
        rendered = value;
        if (active) setState({ status: 'ready', ...value });
        else value.release();
      })
      .catch(() => {
        if (active) setState({ status: 'failed' });
      });
    return () => {
      active = false;
      controller.abort();
      rendered?.release();
    };
  }, [loadContent, render, selectedId, retry]);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      setDimensions({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    selector.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (!selector.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
    };
  }, [menuOpen]);

  const stopDragging = useCallback(() => {
    const activeDrag = drag.current;
    if (activeDrag) {
      drag.current = undefined;
      if (activeDrag.element.hasPointerCapture(activeDrag.pointerId))
        activeDrag.element.releasePointerCapture(activeDrag.pointerId);
    }
    setDragging(false);
  }, []);
  const changePanMode = useCallback((enabled: boolean) => {
    stopDragging();
    setHandActive(enabled);
  }, [stopDragging]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && drag.current) {
        event.preventDefault();
        event.stopPropagation();
        stopDragging();
        return;
      }
      if (
        event.code !== 'Space' ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !pointerInside ||
        (event.target instanceof HTMLElement &&
          !!event.target.closest('button, input, textarea, [role="menu"]'))
      )
        return;
      event.preventDefault();
      setSpaceArmed(true);
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      setSpaceArmed(false);
      stopDragging();
    };
    const blur = () => {
      setSpaceArmed(false);
      stopDragging();
    };
    window.addEventListener('keydown', keyDown, true);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', keyDown, true);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
      stopDragging();
    };
  }, [pointerInside, stopDragging]);

  useLayoutEffect(() => {
    const center = pendingCenter.current;
    const element = viewport.current;
    if (!center || !element) return;
    element.scrollLeft = Math.max(
      0,
      center.x * element.scrollWidth - element.clientWidth / 2,
    );
    element.scrollTop = Math.max(
      0,
      center.y * element.scrollHeight - element.clientHeight / 2,
    );
    pendingCenter.current = undefined;
  }, [zoom]);

  const changeZoom = (next: number) => {
    const bounded = Math.min(400, Math.max(25, next));
    if (bounded === zoom) return;
    const element = viewport.current;
    pendingCenter.current =
      element && element.scrollWidth > 0 && element.scrollHeight > 0
        ? {
            x:
              (element.scrollLeft + element.clientWidth / 2) /
              element.scrollWidth,
            y:
              (element.scrollTop + element.clientHeight / 2) /
              element.scrollHeight,
          }
        : undefined;
    setZoom(bounded);
  };
  const drawing =
    state.status === 'ready' ? (
      <img
        alt={filename}
        className="block h-auto w-full object-contain"
        onLoad={(event) => {
          setImageSize({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          });
        }}
        onError={() => {
          setState({ status: 'failed' });
        }}
        onDragStart={(event) => {
          if (spaceArmed || planSignsApi) event.preventDefault();
        }}
        src={state.src}
      />
    ) : null;
  return (
    <section
      ref={setDrawerHost}
      aria-label={`${filename} preview`}
      className={`relative ${planSignsApi ? 'h-[calc(100dvh-119px)]' : 'h-[calc(100dvh-151px)]'} min-h-[320px] bg-white ${dragging ? 'cursor-grabbing select-none' : panEnabled ? 'cursor-grab select-none' : ''}`}
      onKeyDown={(event) => {
        if (
          event.target instanceof HTMLElement &&
          event.target.closest(
            'input, textarea, select, [aria-label="Sign details"]',
          )
        )
          return;
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === '+' || event.key === '=') changeZoom(zoom + 25);
        else if (event.key === '-') changeZoom(zoom - 25);
        else if (event.key === '0') changeZoom(100);
        else return;
        event.preventDefault();
      }}
      onPointerEnter={() => {
        setPointerInside(true);
      }}
      onPointerLeave={() => {
        if (!drag.current) setPointerInside(false);
      }}
      tabIndex={0}
    >
      <div
        className={`absolute inset-0 overflow-auto ${planSignsApi ? 'bottom-0' : 'bottom-10'}`}
        data-testid="plan-pan-viewport"
        tabIndex={0}
        aria-label="Plan viewport"
        onKeyDown={(event) => {
          if (!handActive || event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          const offsets: Record<string, [number, number]> = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40] };
          const offset = offsets[event.key];
          if (!offset) return;
          event.preventDefault();
          event.stopPropagation();
          scrollWithinPlan(event.currentTarget, event.currentTarget.scrollLeft + offset[0], event.currentTarget.scrollTop + offset[1]);
        }}
        style={{ touchAction: panEnabled ? 'none' : 'auto' }}
        onClickCapture={(event) => {
          // Portaled toolbar/drawer events still traverse this React ancestor.
          if (!event.currentTarget.contains(event.target as Node)) return;
          if (!panEnabled && !suppressPanClick.current) return;
          suppressPanClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDownCapture={(event) => {
          if (!event.currentTarget.contains(event.target as Node)) return;
          if (!drag.current && event.button === 0 && event.isPrimary) suppressPanClick.current = false;
        }}
        onPointerCancel={(event) => { if (drag.current?.pointerId === event.pointerId) stopDragging(); }}
        onLostPointerCapture={(event) => { if (drag.current?.pointerId === event.pointerId) stopDragging(); }}
        onPointerDown={(event) => {
          if (!event.currentTarget.contains(event.target as Node)) return;
          if (!panEnabled || event.button !== 0 || !event.isPrimary || drag.current) return;
          event.preventDefault();
          suppressPanClick.current = true;
          drag.current = {
            pointerId: event.pointerId,
            element: event.currentTarget,
            clientX: event.clientX,
            clientY: event.clientY,
            scrollLeft: event.currentTarget.scrollLeft,
            scrollTop: event.currentTarget.scrollTop,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const activeDrag = drag.current;
          if (activeDrag?.pointerId !== event.pointerId) return;
          scrollWithinPlan(event.currentTarget,
            activeDrag.scrollLeft + activeDrag.clientX - event.clientX,
            activeDrag.scrollTop + activeDrag.clientY - event.clientY);
        }}
        onPointerUp={(event) => { if (drag.current?.pointerId === event.pointerId) stopDragging(); }}
        ref={viewport}
      >
        {state.status === 'loading' ? (
          <p className="grid h-full place-items-center text-sm text-content-muted">
            Loading plan…
          </p>
        ) : state.status === 'failed' ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-content-muted">
            <p>We couldn’t display this plan. Please try again.</p>
            <button
              className="rounded border border-control-border px-3 py-2"
              onClick={() => {
                setRetry((value) => value + 1);
              }}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex min-h-full min-w-full items-center">
            <div
              className="mx-auto shrink-0"
              data-testid="plan-zoom-surface"
              style={{
                width:
                  imageSize.width && dimensions.width
                    ? (Math.min(
                        dimensions.width,
                        (dimensions.height * imageSize.width) /
                          imageSize.height,
                      ) *
                        zoom) /
                      100
                    : `${String(zoom)}%`,
              }}
            >
              {planSignsApi ? (
                <PlanSignsSurface
                  key={`${plan.id}:${selectedId ?? 'legacy'}`}
                  api={planSignsApi}
                  fileId={selectedId ?? null}
                  panning={panEnabled || dragging}
                  drawerHost={drawerHost}
                  onPanModeChange={changePanMode}
                >
                  {drawing}
                </PlanSignsSurface>
              ) : (
                drawing
              )}
            </div>
          </div>
        )}
      </div>
      <div
        ref={selector}
        className="absolute left-0 top-5 z-10 w-[234px] max-w-full text-[12px] text-content"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setMenuOpen(false);
            selectorButton.current?.focus();
            event.stopPropagation();
          }
          if (
            menuOpen &&
            ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
          ) {
            const items = Array.from(
              selector.current?.querySelectorAll<HTMLButtonElement>(
                '[role="menuitem"]',
              ) ?? [],
            );
            const index = items.findIndex(
              (item) => item === document.activeElement,
            );
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? items.length - 1
                  : (index +
                      (event.key === 'ArrowDown' ? 1 : -1) +
                      items.length) %
                    items.length;
            items[next]?.focus();
            event.preventDefault();
            event.stopPropagation();
          }
          if (event.key === 'Tab') setMenuOpen(false);
        }}
      >
        <button
          ref={selectorButton}
          type="button"
          aria-label="Select plan file"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          disabled={(plan.files?.length ?? 1) < 2}
          onClick={() => {
            setMenuOpen((open) => !open);
          }}
          className="flex h-[38px] w-full items-center rounded border border-control-border bg-white text-left shadow-site-card focus-visible:outline-2 focus-visible:outline-focus"
        >
          <span className="grid h-full w-[35px] shrink-0 place-items-center border-r border-control-border">
            <AppSymbol className="!size-[18px] rounded bg-[#f4f4f5] text-[16px] text-content-muted">
              {menuOpen ? 'expand_less' : 'expand_more'}
            </AppSymbol>
          </span>
          <span className="mx-[10px] grid size-5 shrink-0 place-items-center rounded-sm bg-site-symbol text-white">
            <AppSymbol className="!size-4 text-[16px]">layers</AppSymbol>
          </span>
          <span className="truncate pr-3" title={filename}>
            {filename}
          </span>
        </button>
        {menuOpen && (
          <div
            role="menu"
            aria-label="Plan files"
            className="ml-[35px] overflow-hidden rounded-b border border-t-0 border-control-border bg-[#f4f4f5] shadow-site-card"
          >
            {plan.files
              ?.filter((file) => file.id !== selectedId)
              .map((file) => (
                <button
                  key={file.id}
                  type="button"
                  role="menuitem"
                  className="flex h-[38px] w-full items-center border-b border-control-border text-left last:border-b-0 hover:bg-white focus-visible:bg-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
                  onClick={() => {
                    setState({ status: 'loading' });
                    setSelectedId(file.id);
                    setMenuOpen(false);
                    selectorButton.current?.focus();
                  }}
                >
                  <span className="mx-[10px] grid size-5 shrink-0 place-items-center rounded-sm bg-site-symbol text-white">
                    <AppSymbol className="!size-4 text-[16px]">
                      layers
                    </AppSymbol>
                  </span>
                  <span className="truncate pr-3" title={file.filename}>
                    {file.filename}
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>
      {planSignsApi && (
        <div
          aria-label="Plan zoom"
          className="absolute bottom-[60px] -right-3 z-10 flex h-[38px] items-center rounded-full border border-[#e2e2e7] bg-white px-2 text-xs text-[#72727e] [section:has(aside)_&]:right-[338px] [section:has(aside)_&]:bottom-20 max-md:right-0 max-md:bottom-20 max-[1050px]:[section:has(aside)_&]:bottom-[88px] max-[1050px]:[section:has(aside)_&]:right-3 max-[1050px]:[section:has(aside)_&]:z-30"
        >
          <button
            type="button"
            aria-label="Decrease plan zoom"
            className="size-7 text-xl"
            onClick={() => {
              changeZoom(zoom - 25);
            }}
          >
            −
          </button>
          <span className="w-11 text-center">{zoom}%</span>
          <button
            type="button"
            aria-label="Increase plan zoom"
            className="size-7 text-xl"
            onClick={() => {
              changeZoom(zoom + 25);
            }}
          >
            +
          </button>
        </div>
      )}
      {!planSignsApi && <div
        aria-label="Plan viewing controls"
        className="absolute -left-8 -right-8 bottom-0 flex h-10 items-center border-t border-[#e2e2e7] bg-[#fafafa] px-8 text-[10px] leading-[14px] tracking-[0.2px] text-[#72727e] max-md:-left-5 max-md:-right-5 max-md:px-5"
      >
        <div className="flex w-[187px] shrink-0 items-center max-sm:w-[106px]">
          <button
            aria-label="Reset zoom"
            title="Reset to fit (0)"
            className="grid h-6 w-[30px] shrink-0 place-items-center rounded-sm text-[8px] focus-visible:outline-2 focus-visible:outline-focus"
            onClick={() => {
              changeZoom(100);
            }}
            type="button"
          >
            <span className="grid h-[22px] w-full place-items-center border border-[#eeeeF2] bg-white">
              {zoom}%
            </span>
          </button>
          <span
            aria-hidden="true"
            className="w-[11px] shrink-0 text-center text-[8px]"
          >
            +
          </span>
          <button
            aria-label="Zoom in"
            title="Zoom in (+)"
            className="grid size-6 shrink-0 place-items-center rounded-sm text-[10px] focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-40"
            disabled={zoom === 400}
            onClick={() => {
              changeZoom(zoom + 25);
            }}
            type="button"
          >
            <span
              aria-hidden="true"
              className="grid h-[22px] w-[21px] place-items-center border border-[#eeeeF2] bg-white"
            >
              +
            </span>
          </button>
          <span
            aria-hidden="true"
            className="w-[6px] shrink-0 text-center text-[8px]"
          >
            /
          </span>
          <button
            aria-label="Zoom out"
            title="Zoom out (-)"
            className="grid size-6 shrink-0 place-items-center rounded-sm text-[10px] focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-40"
            disabled={zoom === 25}
            onClick={() => {
              changeZoom(zoom - 25);
            }}
            type="button"
          >
            <span
              aria-hidden="true"
              className="grid h-[22px] w-[21px] place-items-center border border-[#eeeeF2] bg-white"
            >
              -
            </span>
          </button>
          <span className="ml-px whitespace-nowrap max-sm:hidden">
            Zoom in / out
          </span>
        </div>
        <kbd className="grid h-[22px] w-16 shrink-0 place-items-center border border-[#eeeef2] bg-white font-sans text-[8px] tracking-[0.5px]">
          SPACEBAR
        </kbd>
        <span className="ml-1 whitespace-nowrap">Hold to navigate</span>
      </div>}
      <span aria-live="polite" className="sr-only">
        Zoom {zoom}%
      </span>
    </section>
  );
}
