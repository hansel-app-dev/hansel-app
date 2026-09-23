/** @spec allocation-plan-comments REQ-001,004..008,012 */
import { z } from 'zod';
import {
  signCommentCreateSchema,
  signCommentSchema,
  commentPersonSchema,
  commentCursorSchema,
} from './sign-comments.js';
export const planCommentCreateSchema = z
  .object({
    idempotencyKey: z.uuid(),
    body: z.string(),
    mentions: signCommentCreateSchema.shape.mentions,
    attachmentIds: signCommentCreateSchema.shape.attachmentIds,
    threadId: z.uuid().nullable(),
    x: z.number().min(0).max(1).nullable(),
    y: z.number().min(0).max(1).nullable(),
  })
  .strict()
  .superRefine((v, c) => {
    const content = signCommentCreateSchema.safeParse({
      idempotencyKey: v.idempotencyKey,
      body: v.body,
      mentions: v.mentions,
      attachmentIds: v.attachmentIds,
      parentId: null,
    });
    if (!content.success)
      for (const issue of content.error.issues)
        c.addIssue({
          code: 'custom',
          path: issue.path,
          message: issue.message,
        });
    if (
      v.threadId ? v.x !== null || v.y !== null : v.x === null || v.y === null
    )
      c.addIssue({
        code: 'custom',
        message: 'Provide coordinates for a new thread only.',
      });
  });
export const planThreadStateSchema = z
  .object({ resolved: z.boolean(), expectedUpdatedAt: z.iso.datetime() })
  .strict();
export const planCommentThreadSchema = z.object({
  id: z.uuid(),
  fileId: z.uuid().nullable(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  author: commentPersonSchema,
  preview: z.string(),
  resolved: z.boolean(),
  resolvedAt: z.iso.datetime().nullable(),
  resolvedById: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const planCommentMarkersSchema = z.object({
  threads: z.array(planCommentThreadSchema),
  nextCursor: commentCursorSchema.nullable(),
  viewer: commentPersonSchema,
});
export const planCommentHistorySchema = z.object({
  thread: planCommentThreadSchema,
  comments: z.array(signCommentSchema),
  nextCursor: commentCursorSchema.nullable(),
  viewer: commentPersonSchema,
});
export const planCommentSubmissionSchema = z.object({
  thread: planCommentThreadSchema,
  comment: signCommentSchema,
});
export type PlanCommentCreate = z.infer<typeof planCommentCreateSchema>;
export type PlanCommentThread = z.infer<typeof planCommentThreadSchema>;
