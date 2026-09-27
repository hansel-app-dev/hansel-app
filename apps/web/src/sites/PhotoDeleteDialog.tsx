/** @spec sign-photos REQ-009 */
import { useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
export function PhotoDeleteDialog({
  filename,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  filename: string;
  pending: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const title = useId();
  const description = useId();
  useLayoutEffect(() => {
    // This dialog is always rendered before its layout effect runs.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const element = dialog.current!;
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
    <dialog
      ref={dialog}
      aria-labelledby={title}
      aria-describedby={description}
      aria-busy={pending}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!pending) onCancel();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
      className="fixed inset-0 m-auto w-[350px] max-w-[calc(100vw-32px)] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-md border-0 bg-white p-0 text-[#27272a] shadow-[0_12px_28px_#00000026] backdrop:bg-[#171724]/30 backdrop:backdrop-blur-[4px]"
    >
      <header className="flex min-h-[52px] items-center justify-between border-b border-[#d4d4dc] px-6">
        <h2 id={title} className="text-[17px] font-semibold">
          Delete photo
        </h2>
        <button
          type="button"
          disabled={pending}
          aria-label="Close delete confirmation"
          onClick={onCancel}
          className="size-5 text-xl leading-5 text-[#72727e]"
        >
          ×
        </button>
      </header>
      <div className="px-6 py-6 text-sm leading-5">
        <p id={description}>This photo will be permanently deleted.</p>
        <p className="mt-2 break-words text-[#72727e]">{filename}</p>
        {error && (
          <p role="alert" className="mt-3 text-[#b42318]">
            {error}
          </p>
        )}
      </div>
      <footer className="flex min-h-[72px] justify-end gap-4 bg-[#f8f9fb] px-6 py-4 text-sm">
        <button
          ref={cancel}
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="h-10 rounded border border-[#d4d4dc] px-4"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className="h-10 rounded bg-[#dc3035] px-4 text-white disabled:opacity-60"
        >
          {pending ? 'Deleting…' : 'Delete'}
        </button>
      </footer>
    </dialog>,
    document.body,
  );
}
