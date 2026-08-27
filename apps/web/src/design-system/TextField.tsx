/**
 * @spec design-system-foundation REQ-003, REQ-005, REQ-006
 * @figma 1:3
 */
import { useId, type ComponentProps, type ReactNode } from 'react';

export interface TextFieldProps extends ComponentProps<'input'> {
  description?: ReactNode;
  error?: ReactNode;
  label: ReactNode;
}

export function TextField({
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  className = '',
  description,
  error,
  id,
  label,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = Array.from(
    new Set(
      [ariaDescribedBy, descriptionId, errorId]
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
      <input
        {...props}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : ariaInvalid}
        className={`min-h-10 rounded-control border-control bg-surface px-field-inline py-field-block text-sm text-content shadow-control outline-none placeholder:text-content-subtle focus-visible:outline-solid focus-visible:outline-[length:var(--focus-ring-width)] focus-visible:outline-offset-[var(--focus-ring-offset)] disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60 ${error ? 'border-danger focus-visible:outline-danger' : 'border-control-border focus-visible:outline-focus'} ${className}`}
        id={inputId}
      />
      {error ? (
        <p className="text-sm text-danger" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
