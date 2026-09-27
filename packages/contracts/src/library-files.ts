/** @spec library-files REQ-002..008 */
import { z } from 'zod';
import { signDocumentSchema } from './sign-documents.js';
import { signPhotoSchema } from './sign-photos.js';
import { allocationPlanNameSchema } from './allocation-plan-drafts.js';
export const libraryFileSchema = z.strictObject({
  id: z.uuid(),
  filename: z.string().min(1).max(255),
  mediaType: z.enum(['image/png', 'image/jpeg', 'application/pdf']),
  byteSize: z.number().int().positive().max(5_242_880),
  uploadedBy: z.string(),
  createdAt: z.iso.datetime(),
  sourceSite: z.object({ id: z.uuid(), name: z.string() }),
  hasThumbnail: z.boolean(),
});
export const libraryFilesSchema = z.object({
  files: z.array(libraryFileSchema),
  nextCursor: z.uuid().nullable(),
});
export const libraryQuerySchema = z.object({
  q: z.string().trim().max(200).default(''),
  kind: z.enum(['all', 'image', 'pdf']).default('all'),
  cursor: z.uuid().optional(),
});
export const librarySelectionSchema = z
  .strictObject({
    idempotencyKey: z.uuid(),
    fileIds: z.array(z.uuid()).min(1).max(50),
  })
  .refine((v) => new Set(v.fileIds).size === v.fileIds.length, {
    message: 'Select each file once',
  });
export const libraryPlanSchema = z.strictObject({
  idempotencyKey: z.uuid(),
  fileId: z.uuid(),
  name: allocationPlanNameSchema,
});
export type LibraryFile = z.infer<typeof libraryFileSchema>;
export type LibraryFiles = z.infer<typeof libraryFilesSchema>;
export type LibraryQuery = z.infer<typeof libraryQuerySchema>;
export type LibrarySelection = z.infer<typeof librarySelectionSchema>;
export type LibraryPlan = z.infer<typeof libraryPlanSchema>;

export const libraryDocumentsResponseSchema = z.object({
  items: z.array(signDocumentSchema),
});
export const libraryPhotosResponseSchema = z.object({
  items: z.array(signPhotoSchema),
});
