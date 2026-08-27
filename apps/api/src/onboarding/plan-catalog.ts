import { planDisplayEntrySchema, type PlanPriceId } from '@hansel/contracts';
import { z } from 'zod';
import catalogJson from './plan-catalog.json' with { type: 'json' };

const catalogEntrySchema = planDisplayEntrySchema.extend({
  active: z.boolean(),
  selfService: z.boolean(),
  displayOrder: z.number().int().nonnegative(),
  stripePriceLookupKey: z.string().min(1).nullable(),
});
const catalogSchema = z
  .object({
    version: z.string().min(1),
    dummy: z.boolean(),
    entries: z.array(catalogEntrySchema).length(6),
  })
  .strict();

export type PlanCatalog = z.infer<typeof catalogSchema>;

export function loadPlanCatalog(
  environment: 'test' | 'production',
  source: unknown = catalogJson,
): PlanCatalog {
  const catalog = catalogSchema.parse(source);
  if (environment === 'production' && catalog.dummy)
    throw new Error('Dummy plan catalog is not permitted in production.');
  if (
    environment === 'production' &&
    catalog.entries.some((entry) =>
      entry.stripePriceLookupKey?.endsWith('_test'),
    )
  )
    throw new Error('Stripe test lookup keys are not permitted in production.');
  return catalog;
}

export function findCatalogEntry(catalog: PlanCatalog, priceId: PlanPriceId) {
  return catalog.entries.find((entry) => entry.priceId === priceId) ?? null;
}
