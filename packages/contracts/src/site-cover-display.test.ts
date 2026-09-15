/** @spec site-cover-image-display REQ-003 */
import { expect, it } from 'vitest';
import { siteSummarySchema } from './index.js';
it('accepts boolean cover availability and old summaries without exposing storage details', () => {
  const summary = {
    id: '7fced42f-e2e4-4c31-89db-f282bdaeea44',
    name: 'Site',
    createdAt: '2026-09-07T00:00:00Z',
    updatedAt: '2026-09-07T00:00:00Z',
    memberCount: 0,
    memberPreview: [],
  };
  expect(siteSummarySchema.parse(summary).hasCoverImage).toBeUndefined();
  expect(
    siteSummarySchema.parse({ ...summary, hasCoverImage: true }).hasCoverImage,
  ).toBe(true);
  expect(
    siteSummarySchema.safeParse({ ...summary, hasCoverImage: 'true' }).success,
  ).toBe(false);
  expect(
    siteSummarySchema.safeParse({ ...summary, objectKey: 'private' }).success,
  ).toBe(false);
});
