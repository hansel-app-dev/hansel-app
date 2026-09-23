/** @spec sign-attribute-custom-dropdowns REQ-001..REQ-006 */
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export function SignAttributeSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  icon,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  icon?: ReactNode | ((value: string) => ReactNode);
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const open = anchor !== null;
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 0,
    maxHeight: 208,
  });
  function show(button: HTMLButtonElement) {
    setActive(Math.max(0, options.indexOf(value)));
    setAnchor(button);
  }
  function choose(option: string) {
    setAnchor(null);
    trigger.current?.focus();
    if (option !== value) onChange(option);
  }
  useEffect(() => {
    if (disabled) setAnchor(null);
  }, [disabled]);
  useLayoutEffect(() => {
    if (!anchor || disabled) return;
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      // Fixed portal coordinates must share the document's CSS zoom scale.
      const scale =
        (parseFloat(getComputedStyle(document.documentElement).zoom) || 1) *
        (parseFloat(getComputedStyle(document.body).zoom) || 1);
      const menuHeight = (options.length * 40 + 8) * scale;
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const upward = below < Math.min(208 * scale, menuHeight) && above > below;
      const maxHeight = Math.max(
        0,
        Math.min(248 * scale, upward ? above : below),
      );
      const width = Math.min(rect.width, Math.max(0, window.innerWidth - 16));
      setPosition({
        width: width / scale,
        left:
          Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) /
          scale,
        top:
          (upward
            ? Math.max(8, rect.top - Math.min(maxHeight, menuHeight) - 4)
            : rect.bottom + 4) / scale,
        maxHeight: maxHeight / scale,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, disabled, options.length]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        setAnchor(null);
    };
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);
  useEffect(() => {
    if (open)
      popup.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);
  return (
    <div>
      <span id={`${id}-label`} className="mb-2 block text-sm">
        {label}
      </span>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={open && !disabled}
        aria-controls={open && !disabled ? `${id}-options` : undefined}
        aria-activedescendant={
          open && !disabled ? `${id}-${String(active)}` : undefined
        }
        disabled={disabled}
        className="flex h-10 w-full items-center gap-2 rounded border border-[#e2e2e7] bg-white px-2 text-left text-sm text-[#27272a] focus-visible:outline-2 focus-visible:outline-[#4096ff] disabled:cursor-default"
        onClick={(event) => {
          if (open) setAnchor(null);
          else show(event.currentTarget);
        }}
        onBlur={(event) => {
          if (!popup.current?.contains(event.relatedTarget)) setAnchor(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            setAnchor(null);
          } else if (
            ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
          ) {
            event.preventDefault();
            event.stopPropagation();
            if (!open) show(event.currentTarget);
            else
              setActive((index) =>
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? options.length - 1
                    : (index +
                        (event.key === 'ArrowDown' ? 1 : options.length - 1)) %
                      options.length,
              );
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            if (!open) show(event.currentTarget);
            else {
              const option = options[active];
              if (option) choose(option);
            }
          } else if (event.key === 'Tab') setAnchor(null);
        }}
      >
        {typeof icon === 'function' ? icon(value) : icon}
        <span className="min-w-0 flex-1 truncate">{value}</span>
        <svg
          aria-hidden="true"
          className="mr-1 shrink-0"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m2 4 4 4 4-4" />
        </svg>
      </button>
      {open &&
        !disabled &&
        createPortal(
          <div
            ref={popup}
            id={`${id}-options`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            style={position}
            className="fixed z-50 overflow-y-auto rounded border border-[#e2e2e7] bg-white py-1 shadow-lg"
          >
            {options.map((option, index) => (
              <div
                key={option}
                id={`${id}-${String(index)}`}
                role="option"
                aria-selected={option === value}
                className={`flex min-h-10 cursor-pointer items-center gap-2 px-2 py-2 text-sm text-[#27272a] ${active === index ? 'bg-[#f1f5f9]' : ''}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onMouseEnter={() => {
                  setActive(index);
                }}
                onClick={() => {
                  choose(option);
                }}
              >
                {typeof icon === 'function' ? icon(option) : icon}
                <span className="min-w-0 break-words">{option}</span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
