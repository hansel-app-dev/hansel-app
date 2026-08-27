/**
 * @spec design-system-foundation REQ-003, REQ-004, REQ-006
 * @figma 1:3
 */
import type { ComponentProps } from 'react';

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: 'primary' | 'secondary';
}

const variantStyles = {
  primary:
    'border-action-primary bg-action-primary text-on-action hover:bg-action-primary-hover',
  secondary:
    'border-control-border bg-surface text-content hover:bg-surface-muted',
} as const;

export function Button({
  className = '',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center rounded-control border-control px-control-inline py-control-block text-sm font-medium shadow-control focus-visible:outline-solid focus-visible:outline-[length:var(--focus-ring-width)] focus-visible:outline-offset-[var(--focus-ring-offset)] focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 ${variantStyles[variant]} ${className}`}
      type={type}
      {...props}
    />
  );
}
