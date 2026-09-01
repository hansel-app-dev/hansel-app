import { yupResolver } from '@hookform/resolvers/yup';
import type {
  CreateOnboardingAccountRequest,
  CreateOnboardingAccountResponse,
} from '@hansel/contracts';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import {
  AuthFormLayout,
  Button,
  ProviderAction,
  TextField,
} from '../design-system/index.js';

const policyVersion = '2026-08-27';

const accountSchema = yup
  .object({
    email: yup
      .string()
      .required('Enter a valid email address.')
      .email('Enter a valid email address.'),
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
  })
  .required();

type AccountForm = yup.InferType<typeof accountSchema>;

const providers = ['google', 'microsoft', 'apple'] as const;

export interface OnboardingStartProps {
  createAccount: (
    input: CreateOnboardingAccountRequest,
  ) => Promise<CreateOnboardingAccountResponse>;
  onCreated?: (
    email: string,
    nextStep: CreateOnboardingAccountResponse['nextStep'],
  ) => void;
}

export function OnboardingStart({
  createAccount,
  onCreated,
}: OnboardingStartProps) {
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<AccountForm>({
    defaultValues: { email: '', password: '' },
    resolver: yupResolver(accountSchema),
  });

  const submit = handleSubmit(async (values) => {
    const result = await createAccount({
      ...values,
      acceptsTerms: true,
      termsVersion: policyVersion,
      privacyVersion: policyVersion,
    });
    onCreated?.(values.email, result.nextStep);
  });

  return (
    <AuthFormLayout
      footer={
        <div className="grid gap-6">
          <p className="text-center text-xs leading-5 text-content-muted">
            By creating an account you agree to our{' '}
            <a className="underline" href="/terms">
              Terms of Service
            </a>{' '}
            and{' '}
            <a className="underline" href="/privacy">
              Privacy Policy
            </a>
            .
          </p>
          <p className="text-center text-sm text-content-muted">
            Already have an account?{' '}
            <a className="underline" href="/login">
              Log in
            </a>
          </p>
        </div>
      }
      heading="Let's get started"
      providerActions={providers.map((provider) => (
        <ProviderAction key={provider} provider={provider} />
      ))}
      providerLabel="or"
    >
      <form noValidate onSubmit={submit}>
        <TextField
          autoComplete="email"
          error={errors.email?.message}
          label="Email"
          placeholder="you@gmail.com"
          type="email"
          {...register('email')}
        />
        <TextField
          autoComplete="new-password"
          error={errors.password?.message}
          label="Password"
          type="password"
          {...register('password')}
        />

        <Button disabled={isSubmitting} type="submit">
          Create with email
        </Button>
      </form>
    </AuthFormLayout>
  );
}
