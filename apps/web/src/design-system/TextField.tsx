/**
 * @spec design-system-foundation REQ-003, REQ-005, REQ-006
 * @figma 1:3
 */
import { useId, type ComponentProps, type ReactNode } from 'react';

export interface TextFieldProps extends ComponentProps<'input'> {
  description?: ReactNode;
  error?: ReactNode;
  label: ReactNode;
  warning?: ReactNode;
}

export function TextField({
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  className = '',
  description,
  error,
  id,
  label,
  warning,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const warningId = warning ? `${inputId}-warning` : undefined;
  const describedBy = Array.from(
    new Set(
      [ariaDescribedBy, descriptionId, errorId, warningId]
        .flatMap((value) => value?.split(/\s+/) ?? [])
        .filter(Boolean),
    ),
  ).join(' ');

  return (
    <div className="grid gap-field-gap">
      <label className="text-sm font-medium text-content" htmlFor={inputId}>
        {label}
      </label>
      {description ? (
        <p className="text-sm text-content-muted" id={descriptionId}>
          {description}
        </p>
      ) : null}
      <span className="relative block">
        <input
          {...props}
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? true : ariaInvalid}
          className={`min-h-10 w-full rounded-control border-control px-field-inline py-field-block pr-10 text-sm text-content shadow-control outline-none placeholder:text-content-subtle focus-visible:outline-solid focus-visible:outline-[length:var(--focus-ring-width)] focus-visible:outline-offset-[var(--focus-ring-offset)] disabled:cursor-not-allowed disabled:opacity-60 ${error ? 'border-danger bg-danger-surface focus-visible:outline-danger' : warning ? 'border-warning bg-warning-surface focus-visible:outline-warning' : 'border-control-border bg-surface focus-visible:outline-focus'} ${className}`}
          id={inputId}
        />
        {error || warning ? (
          <span
            aria-hidden="true"
            className={`material-symbols-100 pointer-events-none absolute right-3 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center text-[20px] ${error ? 'text-danger' : 'text-warning'}`}
          >
            error
          </span>
        ) : null}
      </span>
      {error ? (
        <p className="text-sm text-danger" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
      {warning ? (
        <p className="text-sm text-warning" id={warningId} role="status">
          {warning}
        </p>
      ) : null}
    </div>
  );
}
