/**
 * @spec design-system-foundation REQ-003, REQ-006, REQ-014
 * @figma 1:3, 38:528
 */
import { useId, type ReactNode } from 'react';

export interface AuthFormLayoutProps {
  children: ReactNode;
  footer: ReactNode;
  heading: string;
  providerActions: ReactNode;
  providerLabel: string;
}

export function AuthFormLayout({
  children,
  footer,
  heading,
  providerActions,
  providerLabel,
}: AuthFormLayoutProps) {
  const headingId = useId();

  return (
    <main className="relative min-h-screen bg-white px-5 py-8 text-content sm:p-[30px]">
      <a
        aria-label="Hansel home"
        className="inline-flex h-5 w-[114px] no-underline sm:absolute sm:left-[30px] sm:top-[30px]"
        href="/"
      >
        <img
          alt=""
          aria-hidden="true"
          className="h-5 w-[114px]"
          src="/assets/hansel-logo-beta.svg"
        />
      </a>

      <section
        aria-labelledby={headingId}
        className="mx-auto grid w-full max-w-[350px] gap-10 pt-14 sm:pt-28"
        data-auth-form-layout
      >
        <h1 className="text-[27px] font-normal tracking-[0.3px]" id={headingId}>
          {heading}
        </h1>

        <div className="grid gap-4 [&_form]:grid [&_form]:gap-4 [&_form>button[type=submit]]:justify-self-start">
          {children}
        </div>

        <div className="grid gap-6">
          <div
            aria-hidden="true"
            className="flex items-center gap-2 text-sm text-content-muted"
            data-auth-provider-divider
            data-testid="auth-provider-divider"
          >
            <span>{providerLabel}</span>
            <img
              alt=""
              className="h-px min-w-0 flex-1"
              src="/assets/login-provider-divider.svg"
            />
          </div>

          <div className="grid gap-[14px]" data-auth-provider-group>
            {providerActions}
          </div>
        </div>

        <div>{footer}</div>
      </section>
    </main>
  );
}
