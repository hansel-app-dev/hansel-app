import { describe, expect, it } from 'vitest';
import {
  allocationPlanNameSchema,
  commitAllocationPlanDraftRequestSchema,
} from './allocation-plan-drafts.js';

describe('allocation-plan-multiple-files REQ-002, REQ-008', () => {
  it('trims names, counts Unicode code points, and rejects controls/empty names', () => {
    expect(allocationPlanNameSchema.parse('  Ground floor  ')).toBe(
      'Ground floor',
    );
    expect(allocationPlanNameSchema.safeParse('😀'.repeat(200)).success).toBe(
      true,
    );
    for (const name of ['', '  ', 'x\nname', 'x'.repeat(201)])
      expect(allocationPlanNameSchema.safeParse(name).success).toBe(false);
  });
  it('requires unique ordered file intents and bounded strict input', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const input = {
      name: 'Plan',
      idempotencyKey: 'a'.repeat(32),
      uploadIds: [id],
    };
    expect(
      commitAllocationPlanDraftRequestSchema.safeParse(input).success,
    ).toBe(true);
    for (const uploadIds of [
      [],
      [id, id],
      Array.from({ length: 21 }, () => id),
    ])
      expect(
        commitAllocationPlanDraftRequestSchema.safeParse({
          ...input,
          uploadIds,
        }).success,
      ).toBe(false);
    expect(
      commitAllocationPlanDraftRequestSchema.safeParse({
        ...input,
        tenantId: id,
      }).success,
    ).toBe(false);
  });
});
