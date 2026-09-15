import { expect, it } from 'vitest';
import {
  signCommentCreateSchema,
  commentReactionSchema,
} from './sign-comments.js';
it('sign-comments REQ-006,010: rejects empty/oversized drafts and accepts Unicode and attachment-only comments', () => {
  const draft = {
    idempotencyKey: 'f38e482b-7956-4ec8-bbae-3545e0540264',
    body: '',
    parentId: null,
    mentions: [],
    attachmentIds: [],
  };
  expect(signCommentCreateSchema.safeParse(draft).success).toBe(false);
  expect(
    signCommentCreateSchema.safeParse({ ...draft, body: '🙂'.repeat(5000) })
      .success,
  ).toBe(true);
  expect(
    signCommentCreateSchema.safeParse({ ...draft, body: 'a'.repeat(5001) })
      .success,
  ).toBe(false);
  expect(
    signCommentCreateSchema.safeParse({
      ...draft,
      attachmentIds: [draft.idempotencyKey],
    }).success,
  ).toBe(true);
  expect(
    commentReactionSchema.safeParse({ emoji: '👍', selected: true }).success,
  ).toBe(true);
  expect(
    commentReactionSchema.safeParse({ emoji: 'x', selected: true }).success,
  ).toBe(false);
});
