import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import * as yup from 'yup';
import { Button, VerificationCodeField } from '../design-system/index.js';

const schema = yup.object({
  code: yup
    .string()
    .required('Enter the six-digit code')
    .matches(/^\d{6}$/, 'Enter all six digits'),
});
type FormValues = yup.InferType<typeof schema>;

export interface VerifyEmailProps {
  email: string;
  verify: (input: { email: string; code: string }) => Promise<unknown>;
  resend: (input: { email: string }) => Promise<unknown>;
  resendAvailableInSeconds?: number;
  onVerified?: () => void;
}

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}${'*'.repeat(Math.max(2, local.length - 1))}@${domain}`;
}

export function VerifyEmail({
  email,
  verify,
  resend,
  resendAvailableInSeconds = 60,
  onVerified,
}: VerifyEmailProps) {
  const [serverError, setServerError] = useState('');
  const [resent, setResent] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(
    resendAvailableInSeconds,
  );
  useEffect(() => {
    setSecondsRemaining(resendAvailableInSeconds);
  }, [resendAvailableInSeconds]);
  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timeout = window.setTimeout(() => {
      setSecondsRemaining((seconds) => seconds - 1);
    }, 1000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [secondsRemaining]);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { code: '' },
    resolver: yupResolver(schema),
  });
  const submit = handleSubmit(async ({ code }) => {
    setServerError('');
    try {
      await verify({ email, code });
      onVerified?.();
    } catch {
      setServerError(
        'That code could not be verified. Request a new code and try again.',
      );
    }
  });
  const requestReplacement = async () => {
    setServerError('');
    try {
      await resend({ email });
      setResent(true);
      setSecondsRemaining(60);
    } catch {
      setServerError('We could not send a new code. Please try again.');
    }
  };

  return (
    <main className="relative min-h-screen bg-white px-5 py-8 text-content sm:px-12 sm:py-10">
      <a
        className="inline-flex h-5 w-[114px] no-underline sm:absolute sm:left-[30px] sm:top-[30px]"
        href="/"
        aria-label="Hansel home"
      >
        <img
          alt=""
          aria-hidden="true"
          className="h-5 w-[114px]"
          src="/assets/hansel-logo-beta.svg"
        />
      </a>
      <section
        className="mx-auto grid w-full max-w-90 gap-6 pt-14 sm:pt-28"
        aria-labelledby="verify-heading"
      >
        <div className="grid gap-2">
          <h1
            className="text-2xl font-semibold tracking-tight"
            id="verify-heading"
          >
            Verify your account
          </h1>
          <p className="text-sm leading-6 text-content-muted">
            We emailed you a code at {maskEmail(email)}. Enter it below to
            verify your account and sign in. The code is valid for 15 minutes.
          </p>
        </div>
        <form className="grid gap-4" noValidate onSubmit={submit}>
          <Controller
            control={control}
            name="code"
            render={({ field }) => (
              <VerificationCodeField
                error={errors.code?.message}
                label="Verification code"
                value={field.value}
                onBlur={field.onBlur}
                onChange={field.onChange}
              />
            )}
          />
          {serverError ? (
            <p aria-live="polite" className="text-sm text-danger" role="alert">
              {serverError}
            </p>
          ) : null}
          <Button
            className="w-full !border-content !bg-content !text-white hover:!bg-content"
            disabled={isSubmitting}
            type="submit"
          >
            Next
          </Button>
        </form>
        {secondsRemaining > 0 ? (
          <p className="text-center text-sm text-content-muted">
            Request new code in {secondsRemaining}s
          </p>
        ) : (
          <button
            className="mx-auto text-sm underline"
            type="button"
            onClick={() => void requestReplacement()}
          >
            Request new code
          </button>
        )}
        {resent ? (
          <p
            aria-live="polite"
            className="text-center text-sm text-content-muted"
          >
            If the address is eligible, a new code has been sent.
          </p>
        ) : null}
        <p className="text-sm leading-6 text-content-muted">
          Can&apos;t find the email? Try looking in your spam folder, or you can
          request a new code. If you&apos;re still having problems email us at{' '}
          <a className="underline" href="mailto:support@hanselapp.io">
            support@hanselapp.io
          </a>
        </p>
        <a className="text-sm underline" href="/onboarding">
          Back
        </a>
      </section>
    </main>
  );
}
