/** @spec user-login REQ-001..REQ-003, REQ-008, REQ-019 */
/** @figma 38:528 */
import { yupResolver } from '@hookform/resolvers/yup';
import type { LoginRequest, LoginResponse } from '@hansel/contracts';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { AuthFormLayout, Button, TextField } from '../design-system/index.js';
import { LoginAuthenticationError } from '../api.js';
import { ExternalProviderActions } from './ExternalProviderActions.js';

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

export interface LoginProps {
  login: (input: LoginRequest) => Promise<LoginResponse>;
  onLoggedIn?: (
    destination: LoginResponse['destination'],
    email: string,
  ) => void;
}

export function Login({ login, onLoggedIn }: LoginProps) {
  const passwordResetSucceeded =
    new URLSearchParams(window.location.search).get('password_reset') ===
    'success';
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
    <AuthFormLayout
      footer={
        <p className="text-sm text-content-muted">
          Don&apos;t have an account?{' '}
          <a className="underline" href="/onboarding">
            Create an account
          </a>
        </p>
      }
      heading="Log in to your account"
      providerActions={<ExternalProviderActions intent="login" />}
      providerLabel="or log in with"
    >
      {passwordResetSucceeded ? (
        <p className="text-sm text-content-muted" role="status">
          Your password has been reset. Log in with your new password.
        </p>
      ) : null}

      {serverError ? (
        <p className="text-sm text-danger" role="alert">
          {serverError}
        </p>
      ) : null}

      <form noValidate onSubmit={submit}>
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
        <a
          className="justify-self-start text-sm underline"
          href="/forgot-password"
        >
          Forgot password?
        </a>
        <Button disabled={isSubmitting} type="submit">
          Log in
        </Button>
      </form>
    </AuthFormLayout>
  );
}
