/** @spec sign-additional-type-options REQ-001..REQ-006 */
import { describe, expect, it } from 'vitest';
import { planSignCreateSchema, planSignPatchSchema } from './plan-signs.js';
it('allocation-plan-add-sign-tool REQ-006 accepts chosen mounting on create and Floor on update', () => {
  const input = {
    fileId: null,
    x: 0.2,
    y: 0.4,
    idempotencyKey: crypto.randomUUID(),
  };
  for (const mounting of [
    'Freestanding',
    'Wall-mounted',
    'Overhead',
    'Cantilevered',
    'Floor',
    'Safety Decal',
    'Privacy Decal',
    'Environmental',
  ]) {
    expect(planSignCreateSchema.parse({ ...input, mounting }).mounting).toBe(
      mounting,
    );
    expect(
      planSignPatchSchema.safeParse({
        expectedUpdatedAt: new Date().toISOString(),
        mounting,
      }).success,
    ).toBe(true);
  }
  expect(planSignCreateSchema.safeParse(input).success).toBe(true);
  expect(
    planSignCreateSchema.safeParse({ ...input, mounting: 'Other' }).success,
  ).toBe(false);
});
it('sign-mounting-options REQ-004 accepts all four mounting values', () => {
  for (const mounting of [
    'Freestanding',
    'Wall-mounted',
    'Overhead',
    'Cantilevered',
  ]) {
    expect(
      planSignPatchSchema.safeParse({
        expectedUpdatedAt: new Date().toISOString(),
        mounting,
      }).success,
    ).toBe(true);
  }
});
it('allocation-plan-sign-moving REQ-006: accepts only paired bounded coordinates', () => {
  const expectedUpdatedAt = new Date().toISOString();
  expect(
    planSignPatchSchema.safeParse({ expectedUpdatedAt, x: 0, y: 1 }).success,
  ).toBe(true);
  for (const changes of [
    { x: 0.2 },
    { y: 0.3 },
    { x: -1, y: 0 },
    { x: 0.5, y: Infinity },
  ]) {
    expect(
      planSignPatchSchema.safeParse({ expectedUpdatedAt, ...changes }).success,
    ).toBe(false);
  }
});
describe('allocation-plan-signs REQ-001,007,012 contracts', () => {
  it('rejects outside coordinates and unknown appearance values', () => {
    expect(
      planSignCreateSchema.safeParse({
        x: 2,
        y: 0,
        fileId: null,
        idempotencyKey: crypto.randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      planSignPatchSchema.safeParse({
        expectedUpdatedAt: new Date().toISOString(),
        mounting: 'Other',
      }).success,
    ).toBe(false);
  });
  it('accepts normalized placement coordinates', () => {
    expect(
      planSignCreateSchema.safeParse({
        x: 0.5,
        y: 0.5,
        fileId: null,
        idempotencyKey: crypto.randomUUID(),
      }).success,
    ).toBe(true);
  });
  it('REQ-001 rejects negative, non-finite and incomplete placements', () => {
    const input = {
      x: 0.5,
      y: 0.5,
      fileId: null,
      idempotencyKey: crypto.randomUUID(),
    };
    for (const value of [-0.01, 1.01, NaN, Infinity]) {
      expect(
        planSignCreateSchema.safeParse({ ...input, x: value }).success,
      ).toBe(false);
      expect(
        planSignCreateSchema.safeParse({ ...input, y: value }).success,
      ).toBe(false);
    }
    expect(
      planSignCreateSchema.safeParse({ ...input, fileId: undefined }).success,
    ).toBe(false);
    expect(
      planSignCreateSchema.safeParse({
        ...input,
        tenantId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });
  it('REQ-008 requires a concurrency timestamp and a changed field', () => {
    expect(planSignPatchSchema.safeParse({ code: 'SG.001' }).success).toBe(
      false,
    );
    expect(
      planSignPatchSchema.safeParse({
        expectedUpdatedAt: new Date().toISOString(),
      }).success,
    ).toBe(false);
    expect(
      planSignPatchSchema.safeParse({
        expectedUpdatedAt: new Date().toISOString(),
        code: ' ',
      }).success,
    ).toBe(false);
    expect(
      planSignPatchSchema.safeParse({
        expectedUpdatedAt: new Date().toISOString(),
        content: 'x'.repeat(201),
      }).success,
    ).toBe(false);
  });
  it('REQ-007 accepts each orientation and only the approved appearance options', () => {
    for (const orientation of [
      'left',
      'up-left',
      'up',
      'up-right',
      'right',
      'down-right',
      'down',
      'down-left',
    ]) {
      expect(
        planSignPatchSchema.safeParse({
          expectedUpdatedAt: new Date().toISOString(),
          mounting: 'Wall-mounted',
          function: 'Directional',
          colour: 'Red',
          orientation,
        }).success,
      ).toBe(true);
    }
    expect(
      planSignPatchSchema.safeParse({
        expectedUpdatedAt: new Date().toISOString(),
        orientation: 'north',
      }).success,
    ).toBe(false);
  });
});
