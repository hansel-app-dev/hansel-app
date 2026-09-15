/** @spec sign-documents REQ-004,006,008 */
import { z } from 'zod';
export const signDocumentUploadSchema = z
  .object({
    idempotencyKey: z.uuid(),
    filename: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .refine(
        (value) =>
          !value.includes('/') &&
          !value.includes('\\') &&
          Array.from(value).every(
            (character) =>
              character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
          ),
      ),
    mediaType: z.enum(['image/png', 'image/jpeg', 'application/pdf']),
    byteSize: z.number().int().min(1).max(5_242_880),
    checksumSha256: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
  })
  .strict();
export const signDocumentSchema = signDocumentUploadSchema
  .omit({ idempotencyKey: true, checksumSha256: true })
  .extend({ id: z.uuid(), createdAt: z.iso.datetime() });
export const signDocumentsSchema = z.object({
  documents: z.array(signDocumentSchema),
  nextCursor: z.uuid().nullable(),
});
export const signDocumentIntentSchema = z.object({
  id: z.uuid(),
  completed: z.boolean(),
  uploadUrl: z.url().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});
export type SignDocument = z.infer<typeof signDocumentSchema>;
export type SignDocumentUpload = z.infer<typeof signDocumentUploadSchema>;
