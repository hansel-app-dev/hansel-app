/**
 * @spec design-system-foundation REQ-003, REQ-006, REQ-014
 * @figma 1:3, 38:528
 */
import type { ComponentProps } from 'react';

const providers = {
  apple: { iconClassName: 'h-6 w-5', name: 'Apple' },
  google: { iconClassName: 'size-6', name: 'Google' },
  microsoft: { iconClassName: 'size-6', name: 'Microsoft' },
} as const;

interface ProviderActionCommonProps {
  className?: string;
  provider: keyof typeof providers;
}

type ProviderButtonProps = ProviderActionCommonProps &
  Omit<ComponentProps<'button'>, 'children' | 'className'> & {
    href?: never;
  };

type ProviderLinkProps = ProviderActionCommonProps &
  Omit<ComponentProps<'a'>, 'children' | 'className'> & {
    href: string;
  };

export type ProviderActionProps = ProviderButtonProps | ProviderLinkProps;

const actionClassName =
  'inline-flex min-h-10 w-full items-center justify-center gap-4 rounded-control border-control border-[#afaea7] bg-surface px-control-inline py-control-block text-sm font-normal text-content shadow-control hover:bg-surface-muted focus-visible:outline-solid focus-visible:outline-[length:var(--focus-ring-width)] focus-visible:outline-offset-[var(--focus-ring-offset)] focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50';

export function ProviderAction(props: ProviderActionProps) {
  const { provider, ...actionProps } = props;
  const { iconClassName, name } = providers[provider];
  const content = (
    <>
      <span className="flex w-6 shrink-0 justify-center">
        <img
          alt=""
          aria-hidden="true"
          className={iconClassName}
          src={`/assets/${provider}-logo.svg`}
        />
      </span>
      Continue with {name}
    </>
  );

  if (actionProps.href !== undefined) {
    const { className = '', href, ...linkProps } = actionProps;
    return (
      <a
        className={`${actionClassName} no-underline ${className}`}
        href={href}
        {...linkProps}
      >
        {content}
      </a>
    );
  }

  const {
    className = '',
    type = 'button',
    ...buttonProps
  } = actionProps;
  return (
    <button
      className={`${actionClassName} ${className}`}
      type={type}
      {...buttonProps}
    >
      {content}
    </button>
  );
}
