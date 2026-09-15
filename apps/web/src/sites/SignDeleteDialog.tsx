/** @spec plan-sign-delete-dialog REQ-002..006 */
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function SignDeleteDialog({
  code,
  host,
  pending,
  error,
  conflict,
  onCancel,
  onConfirm,
  onReload,
}: {
  code: string;
  host: HTMLElement;
  pending: boolean;
  error: string;
  conflict: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onReload: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [region, setRegion] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  useLayoutEffect(() => {
    const measure = () => {
      const bounds = host.getBoundingClientRect();
      const drawer = host
        .querySelector('[aria-label="Sign details"]')
        ?.getBoundingClientRect();
      const padding = host.parentElement
        ? parseFloat(getComputedStyle(host.parentElement).paddingLeft) || 0
        : 0;
      const left = Math.max(0, bounds.left - padding);
      const top = Math.max(0, bounds.top);
      const right =
        drawer && drawer.left - left >= 382
          ? drawer.left
          : Math.min(window.innerWidth, bounds.right);
      setRegion({
        left,
        top,
        width: Math.max(0, right - left),
        height: Math.max(
          0,
          Math.min(window.innerHeight, bounds.bottom - 40) - top,
        ),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [host]);
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previous = document.activeElement;
    element.showModal();
    cancel.current?.focus();
    return () => {
      element.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return createPortal(
    <>
      <div
        aria-hidden="true"
        data-testid="sign-delete-backdrop"
        className="pointer-events-none fixed z-50 bg-[#171724]/30 backdrop-blur-[4px]"
        style={region}
      />
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-modal="true"
        aria-busy={pending}
        onCancel={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!pending) onCancel();
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
        }}
        className="fixed m-0 w-[350px] max-w-[calc(100vw-32px)] max-h-[calc(100dvh-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[6px] border-0 bg-white p-0 text-[#27272a] shadow-[0_12px_28px_#00000026] backdrop:bg-transparent"
        style={{
          left: region.left + region.width / 2,
          top: region.top + region.height / 2,
        }}
      >
        <header className="flex min-h-[52px] items-center justify-between gap-3 border-b border-[#d4d4dc] px-6 py-[13px]">
          <h2
            id={titleId}
            className="min-w-0 break-words text-[17px] font-semibold leading-6"
          >
            Delete sign {code}
          </h2>
          <button
            type="button"
            aria-label="Close delete confirmation"
            disabled={pending}
            onClick={onCancel}
            className="grid size-5 shrink-0 place-items-center text-[#72727e] focus-visible:outline-2 focus-visible:outline-[#4096ff] disabled:opacity-50"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            >
              <path d="m4 4 12 12M16 4 4 16" />
            </svg>
          </button>
        </header>
        <div className="px-6 py-6 text-[14px] leading-5">
          <p id={descriptionId}>
            The sign and any comments will be
            <br />
            permanently deleted.
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-[#b42318]">
              {error}
            </p>
          )}
        </div>
        <footer className="flex min-h-[72px] items-center justify-end gap-4 bg-[#f8f9fb] px-6 py-4 text-[14px] leading-5">
          <button
            ref={cancel}
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="h-10 w-[79px] rounded border border-[#d4d4dc] bg-transparent focus-visible:outline-2 focus-visible:outline-[#4096ff] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={conflict ? onReload : onConfirm}
            className="h-10 min-w-[76px] rounded bg-[#dc3035] px-4 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b42318] disabled:opacity-60"
          >
            {pending ? 'Deleting…' : conflict ? 'Reload' : 'Delete'}
          </button>
        </footer>
      </dialog>
    </>,
    document.body,
  );
}
