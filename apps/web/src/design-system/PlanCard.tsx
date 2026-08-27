/** @spec onboarding-plan-selection REQ-015 @figma 52:608 */
import type { PlanDisplayEntry } from '@hansel/contracts';
import { Button } from './Button.js';

export function PlanCard({
  plan,
  disabled = false,
  selected = false,
  onSelect,
}: {
  plan: PlanDisplayEntry;
  disabled?: boolean;
  selected?: boolean;
  onSelect: (priceId: PlanDisplayEntry['priceId']) => void;
}) {
  const monthlyAmount = Number(plan.monthlyEquivalentMinor);
  const price = plan.contactSales
    ? 'Custom'
    : `$${(monthlyAmount / 100).toFixed(monthlyAmount % 100 ? 2 : 0)}/mo`;
  return (
    <article
      className={`flex min-h-[375px] flex-col rounded-control border bg-surface p-workbench ${selected ? 'border-action-primary ring-2 ring-action-primary' : 'border-control-border'}`}
      aria-label={`${plan.displayName} plan${selected ? ', selected' : ''}`}
    >
      <h2 className="text-[22px] font-normal">{plan.displayName}</h2>
      <p className="mt-2 min-h-12 text-sm">{plan.description}</p>
      <ul className="flex-1 space-y-3 py-5 text-sm">
        {plan.features.map((feature) => (
          <li key={feature}>✓&nbsp;&nbsp;{feature}</li>
        ))}
      </ul>
      <div className="mb-5 grid gap-2">
        <strong className="text-[22px] font-normal">{price}</strong>
        <span className="text-sm">
          {plan.contactSales
            ? 'Contact us for pricing'
            : plan.additionalSiteAmountMinor
              ? `+$${String(plan.additionalSiteAmountMinor / 100)} for additional site`
              : 'One site included'}
        </span>
      </div>
      <Button
        disabled={disabled}
        onClick={() => {
          onSelect(plan.priceId);
        }}
      >
        {plan.contactSales ? 'Schedule a call' : `Choose ${plan.displayName}`}
      </Button>
    </article>
  );
}
