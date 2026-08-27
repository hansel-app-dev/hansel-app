/** @spec onboarding-plan-selection REQ-001..REQ-016 @figma 52:608 */
import { useEffect, useMemo, useState } from 'react';
import type {
  BillingInterval,
  PlanPriceId,
  PlanSelectionPageResponse,
  PlanSelectionResponse,
} from '@hansel/contracts';
import { PlanCard } from '../design-system/index.js';

export function PlanSelection({
  loadPlans,
  selectPlan,
  onCompleted = () => undefined,
}: {
  loadPlans: () => Promise<PlanSelectionPageResponse>;
  selectPlan: (priceId: PlanPriceId) => Promise<PlanSelectionResponse>;
  onCompleted?: (result: PlanSelectionResponse) => void;
}) {
  const [state, setState] = useState<PlanSelectionPageResponse | null>(null);
  const [interval, setInterval] = useState<BillingInterval>('annual');
  const [submitting, setSubmitting] = useState<PlanPriceId | null>(null);
  const [selectedPriceId, setSelectedPriceId] = useState<PlanPriceId | null>(
    null,
  );
  const [error, setError] = useState('');
  useEffect(() => {
    void loadPlans()
      .then((result) => {
        setState(result);
        setInterval(result.selectedInterval);
        setSelectedPriceId(result.selectedPriceId);
      })
      .catch(() => {
        setError('We could not load plans. Please try again.');
      });
  }, [loadPlans]);
  const visible = useMemo(
    () =>
      state?.plans.filter(
        (plan) =>
          plan.planId === 'enterprise' || plan.billingInterval === interval,
      ) ?? [],
    [interval, state],
  );
  const choose = async (priceId: PlanPriceId) => {
    setSelectedPriceId(priceId);
    setSubmitting(priceId);
    setError('');
    try {
      onCompleted(await selectPlan(priceId));
    } catch {
      setError('We could not save your plan. Please try again.');
    } finally {
      setSubmitting(null);
    }
  };
  return (
    <main className="min-h-screen bg-canvas p-8 text-content max-sm:p-5">
      <a href="/" aria-label="Hansel home">
        <img className="h-5 w-auto" src="/assets/hansel-logo-beta.svg" alt="" />
      </a>
      <section
        className="mx-auto mt-[150px] w-full max-w-[790px] max-sm:mt-16"
        aria-labelledby="plan-heading"
      >
        <h1 id="plan-heading" className="text-center text-2xl font-normal">
          {state
            ? `Welcome ${state.firstName}, choose your plan`
            : 'Choose your plan'}
        </h1>
        {error ? (
          <p role="alert" className="mt-4 text-center text-error">
            {error}
          </p>
        ) : null}
        <div
          className="my-10 flex items-center justify-center gap-1"
          role="group"
          aria-label="Billing interval"
        >
          {(['monthly', 'annual'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={interval === value}
              onClick={() => {
                setInterval(value);
              }}
              className={`min-w-28 border border-control-border px-6 py-2 capitalize ${interval === value ? 'bg-action-primary text-on-action' : 'bg-surface'}`}
            >
              {value === 'monthly' ? 'Monthly' : 'Annual'}
            </button>
          ))}
          <span className="ml-3 text-sm">Save 35%</span>
        </div>
        {state ? (
          <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
            {visible.map((plan) => (
              <PlanCard
                key={plan.priceId}
                plan={plan}
                disabled={Boolean(submitting)}
                selected={selectedPriceId === plan.priceId}
                onSelect={(id) => void choose(id)}
              />
            ))}
          </div>
        ) : (
          <p role="status" className="text-center">
            Loading plans…
          </p>
        )}
        <button
          type="button"
          className="mt-8 text-sm text-content-muted underline"
          disabled={Boolean(submitting) || !state}
          onClick={() => void choose('free')}
        >
          Or try it for free
        </button>
      </section>
      <a
        className="fixed bottom-14 left-14 rounded-control border border-control-border px-4 py-2 max-sm:static max-sm:mt-10 max-sm:inline-block"
        href="/onboarding/about-you"
      >
        Back
      </a>
    </main>
  );
}
