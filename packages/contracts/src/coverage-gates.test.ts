import { expect, it } from 'vitest';
import { startCoverImageRequestSchema } from './cover-image.js';
import { signCommentCreateSchema } from './sign-comments.js';
import { allocationPlanSchema } from './index.js';

const id = '00000000-0000-4000-8000-000000000001';

it('site-cover-image-add REQ-003: validates filename controls and matching image types', () => {
  const input = {
    idempotencyKey: id,
    filename: 'cover.png',
    mediaType: 'image/png',
    byteSize: 10,
    checksum: 'a'.repeat(64),
  };
  for (const filename of ['cover.png', 'cover.PNG'])
    expect(
      startCoverImageRequestSchema.safeParse({ ...input, filename }).success,
    ).toBe(true);
  for (const filename of ['cover.jpg', 'cover.jpeg'])
    expect(
      startCoverImageRequestSchema.safeParse({
        ...input,
        filename,
        mediaType: 'image/jpeg',
      }).success,
    ).toBe(true);
  for (const override of [
    { filename: 'bad\u0001.png' },
    { filename: 'cover.jpg' },
    { filename: 'cover.png', mediaType: 'image/jpeg' },
  ])
    expect(
      startCoverImageRequestSchema.safeParse({ ...input, ...override }).success,
    ).toBe(false);
});

it('sign-comments REQ-006,010: validates distinct attachments and ordered exact mention ranges', () => {
  const draft = {
    idempotencyKey: id,
    parentId: null,
    body: '@A @B',
    mentions: [
      { membershipId: id, name: 'A', start: 0, end: 2 },
      { membershipId: id, name: 'B', start: 3, end: 5 },
    ],
    attachmentIds: [],
  };
  expect(signCommentCreateSchema.safeParse(draft).success).toBe(true);
  expect(
    signCommentCreateSchema.safeParse({ ...draft, attachmentIds: [id, id] })
      .success,
  ).toBe(false);
  for (const mentions of [
    [draft.mentions[1], draft.mentions[0]],
    [{ ...draft.mentions[0], start: 2, end: 2 }],
    [{ ...draft.mentions[0], name: 'Other' }],
  ])
    expect(
      signCommentCreateSchema.safeParse({ ...draft, mentions }).success,
    ).toBe(false);
});

it('allocation-plan-multiple-files REQ-002: accepts named files and legacy metadata, rejecting incomplete plans', () => {
  const plan = {
    id,
    createdAt: '2026-09-04T00:00:00Z',
    modifiedAt: '2026-09-04T00:00:00Z',
    uploadedBy: 'Owner',
  };
  expect(
    allocationPlanSchema.safeParse({
      ...plan,
      name: 'Ground floor',
      files: [
        { id, filename: 'floor.png', mediaType: 'image/png', byteSize: 10 },
      ],
    }).success,
  ).toBe(true);
  expect(
    allocationPlanSchema.safeParse({
      ...plan,
      filename: 'floor.png',
      mediaType: 'image/png',
      byteSize: 10,
    }).success,
  ).toBe(true);
  expect(allocationPlanSchema.safeParse(plan).success).toBe(false);
});
