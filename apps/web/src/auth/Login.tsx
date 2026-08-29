/** @spec user-login REQ-001..REQ-003, REQ-008, REQ-019 */
/** @figma 38:528 */
import { yupResolver } from '@hookform/resolvers/yup';
import type { LoginRequest, LoginResponse } from '@hansel/contracts';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { Button, TextField } from '../design-system/index.js';
import { LoginAuthenticationError } from '../api.js';

const loginSchema = yup
  .object({
    email: yup
      .string()
      .trim()
      .lowercase()
      .required('Enter a valid email address.')
      .email('Enter a valid email address.'),
    password: yup
      .string()
      .required('Enter your password.')
      .max(128, 'Enter your password.'),
  })
  .required();

type LoginForm = yup.InferType<typeof loginSchema>;

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="size-[22px]" viewBox="0 0 18 18">
      <path
        d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.876 2.684-6.613Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.468-.806 5.956-2.182l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.333A9 9 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.963 10.705A5.41 5.41 0 0 1 3.681 9c0-.592.102-1.167.282-1.705V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.333Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.333C4.672 5.166 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg aria-hidden="true" className="size-[22px]" viewBox="0 0 18 18">
      <path fill="#F25022" d="M0 0h8.5v8.5H0z" />
      <path fill="#7FBA00" d="M9.5 0H18v8.5H9.5z" />
      <path fill="#00A4EF" d="M0 9.5h8.5V18H0z" />
      <path fill="#FFB900" d="M9.5 9.5H18V18H9.5z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-[22px] w-[18px] fill-current"
      viewBox="0 0 18 22"
    >
      <path d="M14.93 11.66c.02 3.05 2.68 4.07 2.71 4.08-.02.08-.42 1.44-1.4 2.85-.84 1.22-1.72 2.44-3.1 2.47-1.36.03-1.79-.8-3.34-.8-1.55 0-2.03.77-3.31.83-1.33.05-2.34-1.33-3.19-2.55C1.56 16.03.23 11.45 2.02 8.34a4.95 4.95 0 0 1 4.2-2.55c1.31-.03 2.55.88 3.34.88.79 0 2.27-1.09 3.83-.93.65.03 2.48.26 3.65 1.96-.09.06-2.18 1.27-2.16 3.95l.05.01ZM12.37 4.1c.7-.84 1.16-2.01 1.03-3.18-1.01.04-2.22.67-2.94 1.51-.65.74-1.22 1.93-1.06 3.07 1.12.09 2.27-.57 2.97-1.4Z" />
    </svg>
  );
}

const providers = [
  { icon: <GoogleMark />, id: 'google', name: 'Google' },
  { icon: <MicrosoftMark />, id: 'microsoft', name: 'Microsoft' },
  { icon: <AppleMark />, id: 'apple', name: 'Apple' },
] as const;

export interface LoginProps {
  login: (input: LoginRequest) => Promise<LoginResponse>;
  onLoggedIn?: (
    destination: LoginResponse['destination'],
    email: string,
  ) => void;
}

export function Login({ login, onLoggedIn }: LoginProps) {
  const [serverError, setServerError] = useState(() => {
    const callbackError = new URLSearchParams(window.location.search).get(
      'error',
    );
    if (callbackError === 'authentication_failed')
      return "We couldn't log you in. Check your details and try again.";
    if (callbackError === 'provider_unavailable')
      return 'Login is temporarily unavailable. Please try again.';
    return '';
  });
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoginForm>({
    defaultValues: { email: '', password: '' },
    resolver: yupResolver(loginSchema),
  });
  const submit = handleSubmit(async (values) => {
    setServerError('');
    try {
      const result = await login(values);
      onLoggedIn?.(result.destination, values.email);
    } catch (error) {
      setServerError(
        error instanceof LoginAuthenticationError
          ? "We couldn't log you in. Check your details and try again."
          : 'Login is temporarily unavailable. Please try again.',
      );
    }
  });

  return (
    <main className="relative min-h-screen bg-white px-5 py-8 text-content sm:px-12 sm:py-10">
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
        aria-labelledby="login-heading"
        className="mx-auto grid w-full max-w-[352px] gap-6 pt-14 sm:pt-[232px]"
      >
        <h1 className="text-2xl font-medium tracking-tight" id="login-heading">
          Log in to your account
        </h1>

        {serverError ? (
          <p className="text-sm text-danger" role="alert">
            {serverError}
          </p>
        ) : null}

        <form className="grid gap-4" noValidate onSubmit={submit}>
          <TextField
            autoComplete="email"
            error={errors.email?.message}
            label="Email"
            placeholder="your@email.com"
            type="email"
            {...register('email')}
          />
          <TextField
            autoComplete="current-password"
            error={errors.password?.message}
            label="Password"
            placeholder="Password"
            type="password"
            {...register('password')}
          />
          <Button
            className="justify-self-start !border-[#485463] !bg-[#485463] !text-white hover:!bg-[#3d4855]"
            disabled={isSubmitting}
            type="submit"
          >
            Log in
          </Button>
        </form>

        <div
          aria-hidden="true"
          className="flex items-center gap-3 text-sm text-content-muted"
        >
          <span>or log in with</span>
          <span className="h-px flex-1 bg-control-border" />
        </div>

        <div className="grid gap-3">
          {providers.map(({ icon, id, name }) => (
            <a
              className="inline-flex min-h-10 w-full items-center justify-center gap-3 rounded-control border-control border-control-border bg-surface px-control-inline py-control-block text-sm font-medium text-content shadow-control no-underline hover:bg-surface-muted focus-visible:outline-solid focus-visible:outline-[length:var(--focus-ring-width)] focus-visible:outline-offset-[var(--focus-ring-offset)] focus-visible:outline-focus"
              href={`/auth/start/${id}?intent=login`}
              key={id}
            >
              <span className="flex w-[22px] justify-center">{icon}</span>
              Continue with {name}
            </a>
          ))}
        </div>

        <p className="text-sm text-content-muted">
          Don&apos;t have an account?{' '}
          <a className="underline" href="/onboarding">
            Create an account
          </a>
        </p>
      </section>
    </main>
  );
}
