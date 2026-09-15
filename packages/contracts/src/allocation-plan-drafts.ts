import { z } from 'zod';

/** @spec allocation-plan-multiple-files REQ-002, REQ-008 */
export const allocationPlanNameSchema = z
  .string()
  .refine(
    (value) =>
      Array.from(value).every(
        (character) =>
          character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
      ),
    'Names cannot contain control characters.',
  )
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(1)
      .refine((value) => Array.from(value).length <= 200),
  );

export const commitAllocationPlanDraftRequestSchema = z
  .object({
    name: allocationPlanNameSchema,
    idempotencyKey: z.string().min(32).max(200),
    uploadIds: z
      .array(z.uuid())
      .min(1)
      .max(20)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .strict();
export type CommitAllocationPlanDraftRequest = z.infer<
  typeof commitAllocationPlanDraftRequestSchema
>;
export const verifyAllocationPlanDraftResponseSchema = z
  .object({ uploadId: z.uuid(), verified: z.literal(true) })
  .strict();
