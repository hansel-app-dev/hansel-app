/** @spec sign-mounting-options REQ-001..005 */
import { useId, useRef, useState } from 'react';
import { signMountingOptions, type SignMounting } from '@hansel/contracts';

export function SignMountingSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: SignMounting;
  onChange: (value: SignMounting) => void;
  disabled?: boolean;
}) {
  const id = useId(),
    trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0);
  function show() {
    setActive(signMountingOptions.indexOf(value));
    setOpen(true);
  }
  function choose(option: SignMounting) {
    setOpen(false);
    trigger.current?.focus();
    if (option !== value) onChange(option);
  }
  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span id={`${id}-label`} className="mb-2 block text-sm">
        Type
      </span>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={open && !disabled}
        aria-controls={open ? `${id}-options` : undefined}
        aria-activedescendant={open ? `${id}-${String(active)}` : undefined}
        disabled={disabled}
        className="flex h-10 w-full items-center gap-2 rounded border border-[#e2e2e7] bg-white px-2 text-left text-sm text-[#27272a] focus-visible:outline-2 focus-visible:outline-[#4096ff] disabled:cursor-default"
        onClick={() => {
          if (open) setOpen(false);
          else show();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (
            ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
          ) {
            event.preventDefault();
            if (!open) show();
            else
              setActive((index) =>
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? signMountingOptions.length - 1
                    : (index + (event.key === 'ArrowDown' ? 1 : signMountingOptions.length - 1)) % signMountingOptions.length,
              );
          } else if ((event.key === 'Enter' || event.key === ' ') && open) {
            event.preventDefault();
            const option = signMountingOptions[active];
            if (option) choose(option);
          } else if (event.key === 'Tab') setOpen(false);
        }}
      >
        <SignMountingIcon value={value} />
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
      {open && !disabled && (
        <div
          id={`${id}-options`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded border border-[#e2e2e7] bg-white py-1 shadow-lg"
        >
          {signMountingOptions.map((option, index) => (
            <div
              key={option}
              id={`${id}-${String(index)}`}
              role="option"
              aria-selected={option === value}
              className={`flex h-10 cursor-pointer items-center gap-2 px-2 text-sm text-[#27272a] ${active === index ? 'bg-[#f1f5f9]' : ''}`}
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
              <SignMountingIcon value={option} />
              <span>{option}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SignMountingIcon({ value }: { value: SignMounting }) {
  const icons: Record<SignMounting, string> = {
    Freestanding: '/assets/sign-freestanding.png',
    'Wall-mounted': '/assets/sign-wall-mounted.png',
    Overhead: '/assets/sign-overhead.png',
    Cantilevered: '/assets/sign-cantilevered.png',
    Floor: '/assets/sign-floor.svg',
  };
  return (
    <img
      src={icons[value]}
      alt=""
      aria-hidden="true"
      data-mounting={value}
      width="24"
      height="24"
      className="block shrink-0"
    />
  );
}
