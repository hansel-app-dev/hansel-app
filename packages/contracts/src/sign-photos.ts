/** @spec sign-photos REQ-007..011 */
import { z } from 'zod';
import {
  signDocumentSchema,
  signDocumentUploadSchema,
  signDocumentIntentSchema,
} from './sign-documents.js';
const mediaType = z.enum(['image/png', 'image/jpeg']);
export const signPhotoUploadSchema = signDocumentUploadSchema.extend({
  mediaType,
});
export const signPhotoSchema = signDocumentSchema.extend({ mediaType });
export const signPhotosSchema = z.object({
  photos: z.array(signPhotoSchema),
  nextCursor: z.uuid().nullable(),
});
export const signPhotoIntentSchema = signDocumentIntentSchema;
export type SignPhoto = z.infer<typeof signPhotoSchema>;
export type SignPhotoUpload = z.infer<typeof signPhotoUploadSchema>;
