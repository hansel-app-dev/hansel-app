/** @spec password-recovery REQ-008..REQ-010, REQ-016, REQ-020 */
import { yupResolver } from '@hookform/resolvers/yup';
import type {
  PasswordRecoveryRequest,
  PasswordRecoveryRequestResponse,
  PasswordResetRequest,
  PasswordResetResponse,
} from '@hansel/contracts';
import { useState, type MouseEvent } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { PasswordResetRejectedError } from '../api.js';
import { Button, TextField } from '../design-system/index.js';

const resetSchema = yup
  .object({
    email: yup
      .string()
      .trim()
      .lowercase()
      .required('Enter a valid email address.')
      .email('Enter a valid email address.'),
    code: yup
      .string()
      .required('Enter the six-digit reset code.')
      .matches(/^\d{6}$/, 'Enter the six-digit reset code.'),
    password: yup
      .string()
      .required('Use at least 15 characters.')
      .test('password-length', 'Use at least 15 characters.', (value) =>
        Boolean(value && Array.from(value).length >= 15),
      )
      .test(
        'password-maximum',
        'Use no more than 128 characters.',
        (value) => !value || Array.from(value).length <= 128,
      )
      .test(
        'password-composition',
        'Include an uppercase letter, lowercase letter, number, and special character.',
        (value) =>
          !value ||
          (/\p{Lu}/u.test(value) &&
            /\p{Ll}/u.test(value) &&
            /\p{N}/u.test(value) &&
            /[\p{P}\p{S}]/u.test(value)),
      ),
    confirmPassword: yup
      .string()
      .required('Confirm your new password.')
      .oneOf([yup.ref('password')], 'Passwords must match.'),
  })
  .required();

const requestSchema = yup
  .string()
  .trim()
  .lowercase()
  .required('Enter a valid email address.')
  .email('Enter a valid email address.');

type FormValues = yup.InferType<typeof resetSchema>;

const requestedMessage =
  "If an eligible Hansel account exists for that email, we've sent a reset code. Check your inbox and spam folder.";

export interface ResetPasswordProps {
  email?: string;
  requestRecovery: (
    input: PasswordRecoveryRequest,
  ) => Promise<PasswordRecoveryRequestResponse>;
  resetPassword: (
    input: PasswordResetRequest,
  ) => Promise<PasswordResetResponse>;
  onReset?: (destination: PasswordResetResponse['destination']) => void;
  onBackToLogin?: () => void;
}

export function ResetPassword({
  email = '',
  requestRecovery,
  resetPassword,
  onReset,
  onBackToLogin,
}: ResetPasswordProps) {
  const [serverError, setServerError] = useState('');
  const [requested, setRequested] = useState(Boolean(email));
  const [isRequesting, setIsRequesting] = useState(false);
  const {
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    register,
    setError,
  } = useForm<FormValues>({
    defaultValues: { email, code: '', password: '', confirmPassword: '' },
    resolver: yupResolver(resetSchema),
  });

  const submit = handleSubmit(async ({ confirmPassword: _, ...values }) => {
    setServerError('');
    try {
      const result = await resetPassword(values);
      onReset?.(result.destination);
    } catch (error) {
      setServerError(
        error instanceof PasswordResetRejectedError
          ? "We couldn't reset your password. Request a new code and try again."
          : 'Password reset is temporarily unavailable. Please try again.',
      );
    }
  });

  async function resend() {
    setServerError('');
    let normalizedEmail: string;
    try {
      normalizedEmail = await requestSchema.validate(getValues('email'));
    } catch {
      setError('email', { message: 'Enter a valid email address.' });
      return;
    }
    setIsRequesting(true);
    try {
      await requestRecovery({ email: normalizedEmail });
      setRequested(true);
    } catch {
      setServerError(
        'Password recovery is temporarily unavailable. Please try again.',
      );
    } finally {
      setIsRequesting(false);
    }
  }

  const backToLoginHandler = onBackToLogin
    ? (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        onBackToLogin();
      }
    : undefined;

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
        aria-labelledby="reset-password-heading"
        className="mx-auto grid w-full max-w-[352px] gap-6 pt-14 sm:pt-[164px]"
      >
        <h1
          className="text-2xl font-medium tracking-tight"
          id="reset-password-heading"
        >
          Reset your password
        </h1>
        <p className="text-sm text-content-muted">
          Enter the code from your email and choose a new password.
        </p>
        {requested ? (
          <p className="text-sm text-content-muted" role="status">
            {requestedMessage}
          </p>
        ) : null}
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
            autoComplete="one-time-code"
            error={errors.code?.message}
            inputMode="numeric"
            label="Reset code"
            maxLength={6}
            placeholder="000000"
            {...register('code')}
          />
          <TextField
            autoComplete="new-password"
            error={errors.password?.message}
            label="New password"
            placeholder="New password"
            type="password"
            {...register('password')}
          />
          <TextField
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            label="Confirm new password"
            placeholder="Confirm new password"
            type="password"
            {...register('confirmPassword')}
          />
          <Button
            className="justify-self-start"
            disabled={isSubmitting || isRequesting}
            type="submit"
          >
            Reset password
          </Button>
        </form>
        <p className="text-sm text-content-muted">
          Didn&apos;t receive a code?{' '}
          <button
            className="underline"
            disabled={isSubmitting || isRequesting}
            onClick={() => void resend()}
            type="button"
          >
            Request a new code
          </button>
        </p>
        <p className="text-sm text-content-muted">
          <a className="underline" href="/login" onClick={backToLoginHandler}>
            Back to log in
          </a>
        </p>
      </section>
    </main>
  );
}
