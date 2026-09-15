/** @spec site-cover-image-add REQ-003, REQ-008..REQ-013 */
import { z } from 'zod';

export const startCoverImageRequestSchema = z
  .object({
    idempotencyKey: z.uuid(),
    filename: z
      .string()
      .min(1)
      .max(255)
      .regex(/^[^/\\]+\.(png|jpe?g)$/i)
      .refine((value) =>
        Array.from(value).every((character) => character.charCodeAt(0) >= 32),
      ),
    mediaType: z.enum(['image/png', 'image/jpeg']),
    byteSize: z.number().int().min(1).max(3_000_000),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .refine(({ filename, mediaType }) =>
    mediaType === 'image/png'
      ? /\.png$/i.test(filename)
      : /\.jpe?g$/i.test(filename),
  );
export const startCoverImageResponseSchema = z
  .object({ uploadId: z.uuid() })
  .strict();
export const finalizeCoverImageResponseSchema = z
  .object({
    destination: z.string().regex(/^\/sites\/[0-9a-f-]{36}\/activity$/),
  })
  .strict();
export type StartCoverImageRequest = z.infer<
  typeof startCoverImageRequestSchema
>;
