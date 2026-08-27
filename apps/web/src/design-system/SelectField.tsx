/** @spec onboarding REQ-086 @figma 52:607 */
import { useId, type ComponentProps, type ReactNode } from 'react';

export interface SelectFieldProps extends ComponentProps<'select'> {
  error?: ReactNode;
  hint?: ReactNode;
  label: ReactNode;
  options: readonly { id: string; label: string }[];
  placeholder?: string;
}

export function SelectField({
  className = '',
  error,
  hint,
  id,
  label,
  options,
  placeholder = 'Select',
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = error ? `${selectId}-error` : undefined;
  const hintId = hint ? `${selectId}-hint` : undefined;
  return (
    <div className="grid min-w-0 gap-field-gap">
      <label className="text-sm font-medium text-content" htmlFor={selectId}>
        {label}
      </label>
      <select
        {...props}
        aria-describedby={
          [hintId, errorId].filter(Boolean).join(' ') || undefined
        }
        aria-invalid={error ? true : props['aria-invalid']}
        className={`min-h-10 min-w-0 w-full appearance-none rounded-control border-control bg-surface bg-[url('/assets/chevron-down.svg')] bg-[length:16px] bg-[position:right_12px_center] bg-no-repeat px-field-inline py-field-block pr-10 text-sm text-content shadow-control outline-none focus-visible:outline-solid focus-visible:outline-[length:var(--focus-ring-width)] focus-visible:outline-offset-[var(--focus-ring-offset)] disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60 ${error ? 'border-danger focus-visible:outline-danger' : 'border-control-border focus-visible:outline-focus'} ${className}`}
        id={selectId}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p className="text-sm text-content-muted" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-danger" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
