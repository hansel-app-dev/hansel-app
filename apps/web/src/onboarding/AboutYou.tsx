/** @spec onboarding REQ-086 @figma 52:607 */
import { yupResolver } from '@hookform/resolvers/yup';
import {
  departmentOptions,
  jobTitleOptions,
  personalProfileRequestSchema,
  type PersonalProfileRequest,
} from '@hansel/contracts';
import { useForm } from 'react-hook-form';
import { useEffect, useRef } from 'react';
import * as yup from 'yup';
import { Button, SelectField, TextField } from '../design-system/index.js';

const requiredText = (message: string) =>
  yup
    .string()
    .transform((value: string) => value.trim().normalize('NFC'))
    .required(message)
    .test(
      'unicode-maximum',
      'Use 100 characters or fewer.',
      (value) => !value || Array.from(value).length <= 100,
    );
const profileSchema = yup
  .object({
    firstName: requiredText('Enter your first name.'),
    lastName: requiredText('Enter your last name.'),
    jobTitle: yup
      .string()
      .oneOf(jobTitleOptions.map(({ id }) => id))
      .required('Select your job title.'),
    jobTitleOther: yup.string().when('jobTitle', {
      is: 'other',
      then: () => requiredText('Enter your job title.'),
      otherwise: (schema) => schema.strip(),
    }),
    department: yup
      .string()
      .oneOf(departmentOptions.map(({ id }) => id))
      .required('Select your department.'),
    departmentOther: yup.string().when('department', {
      is: 'other',
      then: () => requiredText('Enter your department.'),
      otherwise: (schema) => schema.strip(),
    }),
  })
  .required();

type ProfileForm = yup.InferType<typeof profileSchema>;

export interface AboutYouProps {
  submitProfile: (profile: PersonalProfileRequest) => Promise<unknown>;
  onCompleted?: () => void;
}

export function AboutYou({ submitProfile, onCompleted }: AboutYouProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
    watch,
  } = useForm<ProfileForm>({
    defaultValues: {
      firstName: '',
      lastName: '',
      jobTitleOther: '',
      departmentOther: '',
    },
    resolver: yupResolver(profileSchema),
  });
  const jobTitle = watch('jobTitle');
  const department = watch('department');
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  useEffect(() => {
    if (errors.root?.message) errorRef.current?.focus();
  }, [errors.root?.message]);
  const submit = handleSubmit(async (values) => {
    try {
      await submitProfile(personalProfileRequestSchema.parse(values));
      onCompleted?.();
    } catch {
      setError('root', {
        message: 'We could not save your details. Please try again.',
      });
    }
  });

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
        aria-labelledby="about-you-heading"
      >
        <h1
          className="text-2xl font-semibold tracking-tight outline-none"
          id="about-you-heading"
          ref={headingRef}
          tabIndex={-1}
        >
          Tell us about you
        </h1>
        <p className="text-sm text-content-muted">All fields are required.</p>
        <form
          action="/api/onboarding/personal-profile"
          aria-label="Tell us about you form"
          className="grid gap-4"
          encType="application/x-www-form-urlencoded"
          method="post"
          noValidate
          onSubmit={submit}
        >
          <TextField
            autoComplete="given-name"
            error={errors.firstName?.message}
            label="First name"
            required
            {...register('firstName')}
          />
          <TextField
            autoComplete="family-name"
            error={errors.lastName?.message}
            label="Last name"
            required
            {...register('lastName')}
          />
          <SelectField
            error={errors.jobTitle?.message}
            label="Job title"
            options={jobTitleOptions}
            required
            {...register('jobTitle')}
          />
          {jobTitle === 'other' ? (
            <TextField
              error={errors.jobTitleOther?.message}
              label="Other job title"
              required
              {...register('jobTitleOther')}
            />
          ) : null}
          <SelectField
            error={errors.department?.message}
            label="Department"
            options={departmentOptions}
            required
            {...register('department')}
          />
          {department === 'other' ? (
            <TextField
              error={errors.departmentOther?.message}
              label="Other department"
              required
              {...register('departmentOther')}
            />
          ) : null}
          {errors.root?.message ? (
            <p
              className="text-sm text-danger"
              ref={errorRef}
              role="alert"
              tabIndex={-1}
            >
              {errors.root.message}
            </p>
          ) : null}
          <Button
            className="mt-4 w-full !border-content !bg-content !text-white hover:!bg-content sm:fixed sm:bottom-[60px] sm:right-[60px] sm:mt-0 sm:w-auto sm:min-w-24"
            disabled={isSubmitting}
            type="submit"
          >
            Next
          </Button>
        </form>
      </section>
    </main>
  );
}
