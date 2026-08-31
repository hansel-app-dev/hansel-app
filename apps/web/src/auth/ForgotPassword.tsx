/** @spec password-recovery REQ-002..REQ-004, REQ-018, REQ-020 */
import { yupResolver } from '@hookform/resolvers/yup';
import type {
  PasswordRecoveryRequest,
  PasswordRecoveryRequestResponse,
} from '@hansel/contracts';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { Button, TextField } from '../design-system/index.js';

const schema = yup
  .object({
    email: yup
      .string()
      .trim()
      .lowercase()
      .required('Enter a valid email address.')
      .email('Enter a valid email address.'),
  })
  .required();

type FormValues = yup.InferType<typeof schema>;

export interface ForgotPasswordProps {
  requestRecovery: (
    input: PasswordRecoveryRequest,
  ) => Promise<PasswordRecoveryRequestResponse>;
  onRequested?: (email: string) => void;
}

export function ForgotPassword({
  requestRecovery,
  onRequested,
}: ForgotPasswordProps) {
  const [serverError, setServerError] = useState('');
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<FormValues>({
    defaultValues: { email: '' },
    resolver: yupResolver(schema),
  });
  const submit = handleSubmit(async (values) => {
    setServerError('');
    try {
      await requestRecovery(values);
      onRequested?.(values.email);
    } catch {
      setServerError(
        'Password recovery is temporarily unavailable. Please try again.',
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
        aria-labelledby="forgot-password-heading"
        className="mx-auto grid w-full max-w-[352px] gap-6 pt-14 sm:pt-[232px]"
      >
        <h1
          className="text-2xl font-medium tracking-tight"
          id="forgot-password-heading"
        >
          Forgot your password?
        </h1>
        <p className="text-sm text-content-muted">
          Enter your email and we&apos;ll send you a code to reset your
          password.
        </p>
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
          <Button
            className="justify-self-start !border-[#485463] !bg-[#485463] !text-white hover:!bg-[#3d4855]"
            disabled={isSubmitting}
            type="submit"
          >
            Send reset code
          </Button>
        </form>
        <p className="text-sm text-content-muted">
          <a className="underline" href="/login">
            Back to log in
          </a>
        </p>
      </section>
    </main>
  );
}
