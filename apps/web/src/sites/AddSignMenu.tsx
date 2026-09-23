/** @spec allocation-plan-add-sign-tool REQ-002,003,007 */
import { useLayoutEffect, useState } from 'react';
import { signMountingOptions, type SignMounting } from '@hansel/contracts';
import { SignMountingIcon } from './SignMountingSelect.js';

export function AddSignMenu({
  kind = 'sign',
  point,
  bounds,
  onChoose,
  onDismiss,
}: {
  kind?: 'sign' | 'area';
  point: { x: number; y: number };
  bounds: { left: number; top: number; right: number; bottom: number };
  onChoose: (mounting: SignMounting) => void;
  onDismiss: () => void;
}) {
  const scale =
    (parseFloat(getComputedStyle(document.documentElement).zoom) || 1) *
    (parseFloat(getComputedStyle(document.body).zoom) || 1);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({
    left: point.x + 16,
    top: point.y - 14,
  });
  useLayoutEffect(() => {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const left =
      point.x + 16 + rect.width > bounds.right
        ? point.x - rect.width - 16
        : point.x + 16;
    setPosition({
      left:
        Math.max(bounds.left, Math.min(left, bounds.right - rect.width)) /
        scale,
      top:
        Math.max(
          bounds.top,
          Math.min(point.y - 14, bounds.bottom - rect.height),
        ) / scale,
    });
    const first = element.querySelector('button');
    first?.focus({ preventScroll: true });
    if (first)
      element.scrollTop = Math.max(
        0,
        first.offsetTop + first.offsetHeight - element.clientHeight,
      );
    const outside = (event: MouseEvent) => {
      if (element.contains(event.target as Node)) return;
      // A dismissing drawing click must not open another placement menu.
      if (
        event.target instanceof Element &&
        event.target.closest('[aria-label="Plan drawing"]')
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
      onDismiss();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
    };
    const scroll = (event: Event) => {
      if (!element.contains(event.target as Node)) onDismiss();
    };
    document.addEventListener('click', outside, true);
    document.addEventListener('keydown', escape, true);
    document.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', onDismiss);
    return () => {
      document.removeEventListener('click', outside, true);
      document.removeEventListener('keydown', escape, true);
      document.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', onDismiss);
    };
  }, [element, point, bounds, onDismiss, scale]);
  return (
    <div
      ref={setElement}
      role="menu"
      aria-label={kind === 'area' ? 'Add area type' : 'Add sign type'}
      style={{
        ...position,
        maxHeight: Math.max(40, (bounds.bottom - bounds.top) / scale),
        maxWidth: Math.max(40, (bounds.right - bounds.left) / scale),
      }}
      className="fixed z-40 w-40 overflow-auto rounded border border-[#e2e2e7] bg-white text-[#27272a] shadow-lg"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
          return;
        event.preventDefault();
        event.stopPropagation();
        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            'button:not(:disabled)',
          ),
        );
        const index = items.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : (index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) %
                items.length;
        items[next]?.focus();
      }}
    >
      <div className="flex h-10 items-center border-b border-[#e2e2e7] px-2.5 text-xs font-medium">
        {kind === 'area' ? 'Add area' : 'Add sign'}
      </div>
      {(kind === 'area' ? (['Floor'] as const) : signMountingOptions).map(
        (value) => (
          <button
            key={value}
            type="button"
            role="menuitem"
            onClick={() => {
              onChoose(value);
            }}
            className="flex h-10 w-full items-center gap-2.5 border-b border-[#e2e2e7] px-2.5 text-left text-sm hover:bg-[#f4f4f5] focus-visible:bg-[#f1f5f9] focus-visible:outline-none"
          >
            <SignMountingIcon value={value} />
            {value}
          </button>
        ),
      )}
      <button
        type="button"
        role="menuitem"
        disabled
        className="flex h-10 w-full items-center gap-2.5 px-2.5 text-left text-sm text-[#64748b]"
      >
        <span aria-hidden="true" className="w-6 text-center text-xl">
          +
        </span>
        New type
      </button>
    </div>
  );
}
