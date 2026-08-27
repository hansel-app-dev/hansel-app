/** @spec onboarding-organization-profile REQ-001..REQ-015 @figma 11:409 */
import { useEffect, useMemo, useState } from 'react';
import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { organizationProfileRequestSchema } from '@hansel/contracts';
import type {
  OrganizationProfilePageResponse,
  OrganizationProfileRequest,
  OrganizationProfileResponse,
} from '@hansel/contracts';
import { Button, SelectField, TextField } from '../design-system/index.js';

const schema = yup
  .object({
    organizationName: yup.string().trim().required().max(200),
    country: yup.string().required(),
    industry: yup.string().required(),
    placeService: yup.string().required(),
    organizationSize: yup.string().required(),
    submissionKey: yup.string().required(),
  })
  .required();
type FormValues = yup.InferType<typeof schema>;

export function OrganizationProfile({
  loadProfile,
  submitProfile,
  onCompleted = () => undefined,
}: {
  loadProfile: () => Promise<OrganizationProfilePageResponse>;
  submitProfile: (
    input: OrganizationProfileRequest,
  ) => Promise<OrganizationProfileResponse>;
  onCompleted?: (result: OrganizationProfileResponse) => void;
}) {
  const [state, setState] = useState<OrganizationProfilePageResponse | null>(
    null,
  );
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
    defaultValues: {
      organizationName: '',
      country: '',
      industry: '',
      placeService: '',
      organizationSize: '',
      submissionKey: '',
    },
  });
  useEffect(() => {
    void loadProfile()
      .then((result) => {
        setState(result);
        reset((values) => ({ ...values, submissionKey: result.submissionKey }));
      })
      .catch(() => {
        setServerError(
          'We could not load organization details. Please try again.',
        );
      });
  }, [loadProfile, reset]);
  const industry = watch('industry');
  const places = useMemo(
    () => state?.placesByIndustry[industry] ?? [],
    [industry, state],
  );
  useEffect(() => {
    setValue('placeService', '');
  }, [industry, setValue]);
  return (
    <main className="min-h-screen bg-canvas p-8 text-content max-sm:p-5">
      <a href="/" aria-label="Hansel home">
        <img className="h-5 w-auto" src="/assets/hansel-logo-beta.svg" alt="" />
      </a>
      <section
        className="mx-auto mt-[150px] w-full max-w-[350px] max-sm:mt-16"
        aria-labelledby="organization-heading"
      >
        <h1 id="organization-heading" className="mb-7 text-2xl font-normal">
          Now your organization
        </h1>
        {serverError ? (
          <p role="alert" className="mb-4 text-error">
            {serverError}
          </p>
        ) : null}
        {state ? (
          <form
            className="grid gap-4"
            onSubmit={handleSubmit(async (input) => {
              setServerError('');
              try {
                onCompleted(
                  await submitProfile(
                    organizationProfileRequestSchema.parse(input),
                  ),
                );
              } catch {
                setServerError(
                  'We could not save your organization. Review the form and try again.',
                );
              }
            })}
          >
            <input type="hidden" {...register('submissionKey')} />
            <TextField
              label="Organization"
              error={errors.organizationName?.message}
              {...register('organizationName')}
            />
            <SelectField
              label="Country"
              options={state.countries}
              error={errors.country?.message}
              {...register('country')}
            />
            <SelectField
              label="Industry or sector"
              options={state.industries}
              error={errors.industry?.message}
              {...register('industry')}
            />
            <SelectField
              label="Type of place or service"
              options={places}
              disabled={!industry}
              hint={!industry ? 'Select an industry first.' : undefined}
              error={errors.placeService?.message}
              {...register('placeService')}
            />
            <SelectField
              label="Size"
              options={state.sizes}
              error={errors.organizationSize?.message}
              {...register('organizationSize')}
            />
            <Button
              className="fixed bottom-14 right-14 max-sm:static max-sm:mt-5"
              type="submit"
              disabled={isSubmitting}
            >
              Next
            </Button>
          </form>
        ) : serverError ? null : (
          <p role="status">Loading organization details…</p>
        )}
      </section>
    </main>
  );
}
