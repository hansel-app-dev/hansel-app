/** @spec sites-add-new REQ-017, REQ-020, REQ-021 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface ModalProps {
  backdrop?: 'default' | 'blurred';
  children: ReactNode;
  initialFocus?: 'first-control' | 'dialog';
  onClose: () => void;
  size?: 'compact' | 'default' | 'wide';
  title: string;
}

const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  backdrop = 'default',
  children,
  initialFocus = 'first-control',
  onClose,
  size = 'default',
  title,
}: ModalProps) {
  const [dialog, setDialog] = useState<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    if (!dialog) return;
    const firstFocusable = dialog.querySelector<HTMLElement>(focusableSelector);
    (initialFocus === 'dialog' ? dialog : (firstFocusable ?? dialog)).focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      );
      const first = focusable.shift();
      if (!first) {
        event.preventDefault();
        return;
      }
      const last = focusable.reduce(
        (_lastFocusable, candidate) => candidate,
        first,
      );
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [dialog, initialFocus]);

  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4 ${backdrop === 'blurred' ? 'bg-[#171717]/30 backdrop-blur-[3px]' : 'bg-[#171717]/45'}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-labelledby="modal-title"
        aria-modal="true"
        className={`my-auto max-h-[calc(100vh-2rem)] w-full overflow-y-auto rounded-lg bg-surface text-content shadow-2xl outline-none ${size === 'wide' ? 'max-w-[900px]' : size === 'compact' ? 'max-w-[500px]' : 'max-w-[600px]'}`}
        ref={setDialog}
        role="dialog"
        tabIndex={-1}
      >
        <span className="sr-only" id="modal-title">
          {title}
        </span>
        {children}
      </div>
    </div>
  );
}
