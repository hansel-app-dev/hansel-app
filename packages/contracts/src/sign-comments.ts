/** @spec sign-comments REQ-001,005..010 */
import { z } from 'zod';
import {
  signDocumentSchema,
  signDocumentUploadSchema,
  signDocumentIntentSchema,
} from './sign-documents.js';
export const commentEmoji = ['👍', '👎', '❤️', '🎉', '😄', '👀'] as const;
export const commentReactionSchema = z
  .object({ emoji: z.enum(commentEmoji), selected: z.boolean() })
  .strict();
export const commentPersonSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  initials: z.string(),
});
export const commentMentionSchema = z
  .object({
    membershipId: z.uuid(),
    name: z.string().min(1).max(200),
    start: z.number().int().min(0),
    end: z.number().int().min(1),
  })
  .strict();
export const signCommentCreateSchema = z
  .object({
    idempotencyKey: z.uuid(),
    body: z.string().refine((value) => Array.from(value).length <= 5000),
    parentId: z.uuid().nullable(),
    mentions: z.array(commentMentionSchema).max(20),
    attachmentIds: z.array(z.uuid()).max(5),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.body.trim() && !value.attachmentIds.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Write a comment or attach a file.',
      });
    if (new Set(value.attachmentIds).size !== value.attachmentIds.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate attachment.' });
    let end = 0;
    for (const mention of value.mentions) {
      if (
        mention.start < end ||
        mention.end <= mention.start ||
        value.body.slice(mention.start, mention.end) !== `@${mention.name}`
      )
        ctx.addIssue({ code: 'custom', message: 'Invalid mention range.' });
      end = mention.end;
    }
  });
export const commentAttachmentSchema = signDocumentSchema;
export const commentAttachmentUploadSchema = signDocumentUploadSchema;
export const commentAttachmentIntentSchema = signDocumentIntentSchema;
export const signCommentSchema = z.object({
  id: z.uuid(),
  parentId: z.uuid().nullable(),
  body: z.string(),
  author: commentPersonSchema,
  createdAt: z.iso.datetime(),
  mentions: z.array(commentMentionSchema),
  attachments: z.array(commentAttachmentSchema),
  reactions: z.array(
    z.object({
      emoji: z.enum(commentEmoji),
      count: z.number().int().min(1),
      selected: z.boolean(),
    }),
  ),
});
export const commentCursorSchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
});
export const signCommentsPageSchema = z.object({
  comments: z.array(signCommentSchema),
  nextCursor: commentCursorSchema.nullable(),
  viewer: commentPersonSchema,
});
export const commentPeopleSchema = z.object({
  people: z.array(commentPersonSchema),
  nextCursor: z.uuid().nullable(),
});
export type SignComment = z.infer<typeof signCommentSchema>;
export type SignCommentCreate = z.infer<typeof signCommentCreateSchema>;
export type CommentPerson = z.infer<typeof commentPersonSchema>;
export type CommentMention = z.infer<typeof commentMentionSchema>;
export type CommentCursor = z.infer<typeof commentCursorSchema>;
export type CommentAttachment = z.infer<typeof commentAttachmentSchema>;
