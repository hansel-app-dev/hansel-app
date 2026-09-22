/** @spec sign-function-options REQ-003, REQ-004 */
import { expect, it } from 'vitest';
import { planSignPatchSchema, planSignSchema } from './plan-signs.js';

const sign = {
  id: '00000000-0000-4000-8000-000000000001',
  fileId: null,
  x: 0.5,
  y: 0.5,
  code: 'SG.001',
  content: '',
  mounting: 'Wall-mounted',
  colour: 'Red',
  orientation: 'down',
  updatedAt: '2026-09-22T00:00:00.000Z',
};
it.each([
  'Identification',
  'Directional',
  'Informational',
  'Regulatory/Statutory',
])('REQ-003 accepts %s for writes and reads', (value) => {
  expect(
    planSignPatchSchema.parse({
      expectedUpdatedAt: sign.updatedAt,
      function: value,
    }).function,
  ).toBe(value);
  expect(planSignSchema.parse({ ...sign, function: value }).function).toBe(
    value,
  );
});
it.each(['Wayfinder', 'Other', '', 'directional'])(
  'REQ-003 rejects unsupported write %s',
  (value) => {
    expect(
      planSignPatchSchema.safeParse({
        expectedUpdatedAt: sign.updatedAt,
        function: value,
      }).success,
    ).toBe(false);
  },
);
it('REQ-004 reads legacy Wayfinder as Directional during rollout', () => {
  expect(
    planSignSchema.parse({ ...sign, function: 'Wayfinder' }).function,
  ).toBe('Directional');
});
