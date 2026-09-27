import { describe, expect, it } from 'vitest';
import {
  createSignRequestSchema,
  signSchema,
  updateSignRequestSchema,
} from './index.js';

const values = {
  code: 'SG.001',
  quantity: 1,
  location: '',
  content: '',
  comments: '',
};
const sign = {
  ...values,
  id: '00000000-0000-4000-8000-000000000011',
  signTypeId: '00000000-0000-4000-8000-000000000010',
  createdAt: '2026-09-27T00:00:00.000Z',
  updatedAt: '2026-09-27T00:00:00.000Z',
};

describe('signage-schedule-remove-status REQ-003: strict shared Sign contracts', () => {
  it('accepts status-free creation and canonical responses', () => {
    expect(createSignRequestSchema.parse(values)).toEqual(values);
    expect(signSchema.parse(sign)).toEqual(sign);
  });

  it.each(['UNSPECIFIED', 'IN_PROGRESS', 'APPROVED'])(
    'rejects legacy %s status in creation, responses and updates',
    (status) => {
      expect(
        createSignRequestSchema.safeParse({ ...values, status }).success,
      ).toBe(false);
      expect(signSchema.safeParse({ ...sign, status }).success).toBe(false);
      expect(
        updateSignRequestSchema.safeParse({
          field: 'status',
          value: status,
          expectedUpdatedAt: sign.updatedAt,
        }).success,
      ).toBe(false);
    },
  );
});
