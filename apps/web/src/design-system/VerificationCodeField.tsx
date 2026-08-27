/**
 * @spec onboarding REQ-084
 * @figma 52:560
 */
import { useId, type ChangeEvent, type InputHTMLAttributes } from 'react';

export interface VerificationCodeFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'maxLength' | 'type' | 'value' | 'onChange'
> {
  error?: string | undefined;
  label: string;
  onChange: (value: string) => void;
  value: string;
}

const CODE_LENGTH = 6;

export function VerificationCodeField({
  'aria-describedby': ariaDescribedBy,
  error,
  id,
  label,
  onChange,
  value,
  ...props
}: VerificationCodeFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(' ');
  const digits = value.slice(0, CODE_LENGTH).padEnd(CODE_LENGTH, ' ');
  const activeCell = Math.min(value.length, CODE_LENGTH - 1);
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(
      event.currentTarget.value.replace(/\D/g, '').slice(0, CODE_LENGTH),
    );
  };

  return (
    <div className="grid gap-2">
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <div className="group relative grid w-full grid-cols-6 gap-[10px]">
        {Array.from(digits).map((digit, index) => (
          <span
            aria-hidden="true"
            className={`flex aspect-square items-center justify-center rounded-control border bg-surface text-xl font-medium text-content shadow-control ${error ? 'border-danger' : 'border-control-border'} ${index === activeCell ? 'group-focus-within:outline group-focus-within:outline-2 group-focus-within:outline-offset-2 group-focus-within:outline-focus' : ''}`}
            key={index}
          >
            {digit}
          </span>
        ))}
        <input
          {...props}
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? true : undefined}
          autoComplete="one-time-code"
          className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
          id={inputId}
          inputMode="numeric"
          maxLength={CODE_LENGTH}
          pattern="[0-9]*"
          type="text"
          value={value}
          onChange={handleChange}
        />
      </div>
      {error ? (
        <p className="text-sm text-danger" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
