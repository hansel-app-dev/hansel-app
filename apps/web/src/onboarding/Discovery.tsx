/** @spec onboarding-discovery REQ-001..REQ-016 @figma 37:649 */
import { useEffect, useState } from 'react';
import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { discoveryRequestSchema } from '@hansel/contracts';
import type {
  DiscoveryPageResponse,
  DiscoveryRequest,
  DiscoveryResponse,
} from '@hansel/contracts';
import { Button, SelectField, TextField } from '../design-system/index.js';

const schema = yup
  .object({
    currentManagement: yup
      .string()
      .oneOf(
        ['pdf', 'spreadsheet', 'other'],
        'Select how you currently manage signage.',
      )
      .required('Select how you currently manage signage.'),
    currentManagementOther: yup.string().when('currentManagement', {
      is: 'other',
      then: (value) =>
        value
          .trim()
          .required('Enter the other tool.')
          .max(100, 'Use 100 characters or fewer.'),
      otherwise: (value) => value.optional(),
    }),
    challenges: yup
      .string()
      .trim()
      .max(1_000, 'Use 1,000 characters or fewer.')
      .optional(),
    submissionKey: yup.string().required(),
  })
  .required();
type FormValues = yup.InferType<typeof schema>;

export function Discovery({
  loadDiscovery,
  completeDiscovery,
  onBack = () => undefined,
  onCompleted = () => undefined,
}: {
  loadDiscovery: () => Promise<DiscoveryPageResponse>;
  completeDiscovery: (input: DiscoveryRequest) => Promise<DiscoveryResponse>;
  onBack?: () => void;
  onCompleted?: (result: DiscoveryResponse) => void;
}) {
  const [page, setPage] = useState<DiscoveryPageResponse | null>(null);
  const [serverError, setServerError] = useState('');
  const [isSkipping, setIsSkipping] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    setValue,
    watch,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
    defaultValues: {
      currentManagementOther: '',
      challenges: '',
      submissionKey: '',
    },
  });
  useEffect(() => {
    void loadDiscovery()
      .then((result) => {
        setPage(result);
        reset((values) => ({ ...values, submissionKey: result.submissionKey }));
      })
      .catch(() => {
        setServerError('We could not load these questions. Please try again.');
      });
  }, [loadDiscovery, reset]);
  const currentManagement = watch('currentManagement');
  useEffect(() => {
    if (currentManagement === 'other') return;
    setValue('currentManagementOther', '');
    clearErrors('currentManagementOther');
  }, [clearErrors, currentManagement, setValue]);
  const pending = isSubmitting || isSkipping;

  const submit = handleSubmit(
    async (values) => {
      setServerError('');
      const request = discoveryRequestSchema.parse({
        action: 'submit',
        currentManagement: values.currentManagement,
        ...(values.currentManagementOther
          ? { currentManagementOther: values.currentManagementOther }
          : {}),
        ...(values.challenges ? { challenges: values.challenges } : {}),
        submissionKey: values.submissionKey,
      });
      try {
        onCompleted(await completeDiscovery(request));
      } catch {
        setServerError('We could not save your answers. Please try again.');
      }
    },
    (invalid) => {
      if (invalid.currentManagement) setFocus('currentManagement');
      else if (invalid.currentManagementOther)
        setFocus('currentManagementOther');
      else setFocus('challenges');
    },
  );

  return (
    <main className="min-h-screen bg-canvas p-8 text-content max-sm:p-5">
      <a href="/" aria-label="Hansel home">
        <img className="h-5 w-auto" src="/assets/hansel-logo-beta.svg" alt="" />
      </a>
      <section
        className="mx-auto mt-[310px] w-full max-w-[350px] max-sm:mt-16"
        aria-labelledby="discovery-heading"
      >
        <h1 id="discovery-heading" className="mb-7 text-2xl font-normal">
          Could you tell us more?
        </h1>
        {serverError ? (
          <p role="alert" className="mb-4 text-danger">
            {serverError}
          </p>
        ) : null}
        {page ? (
          <form className="grid gap-4" onSubmit={submit}>
            <input type="hidden" {...register('submissionKey')} />
            <SelectField
              label="How do you manage your signage currently?"
              options={page.methods}
              error={errors.currentManagement?.message}
              {...register('currentManagement')}
            />
            {currentManagement === 'other' ? (
              <TextField
                label="Other tools"
                error={errors.currentManagementOther?.message}
                {...register('currentManagementOther')}
              />
            ) : null}
            <TextField
              label="Biggest challenges your team faces"
              placeholder="Challenges"
              error={errors.challenges?.message}
              {...register('challenges')}
            />
            <footer className="fixed bottom-14 left-14 right-14 flex items-center justify-between max-sm:static max-sm:mt-5 max-sm:items-stretch">
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={onBack}
              >
                Back
              </Button>
              <div className="flex items-center gap-4 max-sm:flex-col-reverse max-sm:items-stretch">
                <Button type="submit" disabled={pending}>
                  Next
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => {
                    setServerError('');
                    setIsSkipping(true);
                    void completeDiscovery({
                      action: 'skip',
                      submissionKey: page.submissionKey,
                    })
                      .then(onCompleted)
                      .catch(() => {
                        setServerError(
                          'We could not skip these questions. Please try again.',
                        );
                      })
                      .finally(() => {
                        setIsSkipping(false);
                      });
                  }}
                >
                  Skip for now
                </Button>
              </div>
            </footer>
          </form>
        ) : serverError ? null : (
          <p role="status">Loading questions…</p>
        )}
      </section>
    </main>
  );
}
