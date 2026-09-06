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

export interface RenderedPlan {
  src: string;
  release(): void;
}

export async function renderPlan(blob: Blob): Promise<RenderedPlan> {
  if (blob.type !== 'application/pdf') {
    const src = URL.createObjectURL(blob);
    return { src, release: () => URL.revokeObjectURL(src) };
  }
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const document = await pdfjs.getDocument({ data: await blob.arrayBuffer() })
    .promise;
  try {
    const page = await document.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('allocation_plan_preview_failed');
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const rendered = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error('allocation_plan_preview_failed')),
        'image/png',
      ),
    );
    const src = URL.createObjectURL(rendered);
    return { src, release: () => URL.revokeObjectURL(src) };
  } finally {
    await document.destroy();
  }
}

export function AllocationPlanViewer({
  plan,
  loadContent,
  render = renderPlan,
}: {
  plan: AllocationPlan;
  loadContent: () => Promise<Blob>;
  render?: (blob: Blob) => Promise<RenderedPlan>;
}) {
  const [zoom, setZoom] = useState(100);
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'failed' }
    | ({ status: 'ready' } & RenderedPlan)
  >({ status: 'loading' });
  const [pointerInside, setPointerInside] = useState(false);
  const [spaceArmed, setSpaceArmed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const pendingCenter = useRef<{ x: number; y: number } | undefined>(
    undefined,
  );
  const drag = useRef<
    | {
        pointerId: number;
        clientX: number;
        clientY: number;
        scrollLeft: number;
        scrollTop: number;
      }
    | undefined
  >(undefined);
  useEffect(() => {
    let active = true;
    let rendered: RenderedPlan | undefined;
    void loadContent()
      .then(render)
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
      rendered?.release();
    };
  }, [loadContent, render]);

  const stopDragging = useCallback(() => {
    const activeDrag = drag.current;
    if (activeDrag) {
      const element = viewport.current;
      if (element?.hasPointerCapture(activeDrag.pointerId))
        element.releasePointerCapture(activeDrag.pointerId);
      drag.current = undefined;
    }
    setDragging(false);
  }, []);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (
        event.code !== 'Space' ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !pointerInside
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
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', keyDown);
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
  return (
    <section
      aria-label={`${plan.filename} preview`}
      className={`relative mt-4 min-h-[calc(100vh-190px)] overflow-hidden rounded border border-control-border bg-[#fafafa] ${dragging ? 'cursor-grabbing select-none' : spaceArmed ? 'cursor-grab select-none' : ''}`}
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === '+' || event.key === '=') changeZoom(zoom + 25);
        else if (event.key === '-') changeZoom(zoom - 25);
        else if (event.key === '0') changeZoom(100);
        else return;
        event.preventDefault();
      }}
      onPointerEnter={() => setPointerInside(true)}
      onPointerLeave={() => {
        if (!drag.current) setPointerInside(false);
      }}
      tabIndex={0}
    >
      <div
        className="absolute inset-0 overflow-auto p-4 pb-20"
        data-testid="plan-pan-viewport"
        onPointerCancel={stopDragging}
        onPointerDown={(event) => {
          if (!spaceArmed || event.button !== 0) return;
          event.preventDefault();
          drag.current = {
            pointerId: event.pointerId,
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
          if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
          event.currentTarget.scrollLeft =
            activeDrag.scrollLeft + activeDrag.clientX - event.clientX;
          event.currentTarget.scrollTop =
            activeDrag.scrollTop + activeDrag.clientY - event.clientY;
        }}
        onPointerUp={stopDragging}
        ref={viewport}
      >
        {state.status === 'loading' ? (
          <p className="grid h-full place-items-center text-sm text-content-muted">
            Loading plan…
          </p>
        ) : state.status === 'failed' ? (
          <p className="grid h-full place-items-center text-sm text-content-muted">
            We couldn’t display this plan. Please try again.
          </p>
        ) : (
          <div className="flex min-h-full min-w-full items-center">
            <div
              className="mx-auto shrink-0"
              data-testid="plan-zoom-surface"
              style={{ width: `${zoom}%` }}
            >
              <img
                alt={plan.filename}
                className="block h-auto w-full object-contain"
                onDragStart={(event) => {
                  if (spaceArmed) event.preventDefault();
                }}
                src={state.src}
              />
            </div>
          </div>
        )}
      </div>
      <div className="absolute bottom-4 right-4 flex items-center rounded border border-control-border bg-surface shadow-site-card">
        <button
          aria-label="Zoom out"
          className="grid size-10 place-items-center disabled:opacity-40"
          disabled={zoom === 25}
          onClick={() => changeZoom(zoom - 25)}
          type="button"
        >
          <AppSymbol className="!size-5 text-[20px]" weight={100}>
            remove
          </AppSymbol>
        </button>
        <button
          aria-label="Reset zoom"
          className="min-h-10 min-w-16 border-x border-control-border px-2 text-xs"
          onClick={() => changeZoom(100)}
          type="button"
        >
          {zoom}%
        </button>
        <button
          aria-label="Zoom in"
          className="grid size-10 place-items-center disabled:opacity-40"
          disabled={zoom === 400}
          onClick={() => changeZoom(zoom + 25)}
          type="button"
        >
          <AppSymbol className="!size-5 text-[20px]" weight={100}>
            add
          </AppSymbol>
        </button>
      </div>
      <span aria-live="polite" className="sr-only">
        Zoom {zoom}%
      </span>
    </section>
  );
}
