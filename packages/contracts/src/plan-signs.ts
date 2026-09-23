/** @spec allocation-plan-signs REQ-001, REQ-007, REQ-008, REQ-012 */
import { z } from 'zod';

const text = (maximum: number) =>
  z
    .string()
    .trim()
    .transform((value) => value.normalize('NFC'))
    .pipe(z.string().refine((value) => Array.from(value).length <= maximum));
export const planSignOrientationSchema = z.enum([
  'left',
  'up-left',
  'up',
  'up-right',
  'right',
  'down-right',
  'down',
  'down-left',
]);
export const signMountingOptions = [
  'Freestanding',
  'Wall-mounted',
  'Overhead',
  'Cantilevered',
  'Floor',
  'Safety Decal',
  'Privacy Decal',
  'Environmental',
] as const;
export const signMountingSchema = z.enum(signMountingOptions);
export type SignMounting = z.infer<typeof signMountingSchema>;
/** @spec sign-function-options REQ-001, REQ-003, REQ-004 */
export const signFunctionOptions = [
  'Identification',
  'Directional',
  'Informational',
  'Regulatory/Statutory',
] as const;
export const signFunctionSchema = z.enum(signFunctionOptions);
const appearance = {
  mounting: signMountingSchema,
  function: signFunctionSchema,
  colour: z.literal('Red'),
  orientation: planSignOrientationSchema,
};
export const planSignCreateSchema = z
  .object({
    fileId: z.uuid().nullable(),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    idempotencyKey: z.uuid(),
    mounting: signMountingSchema.optional(),
  })
  .strict();
export const planSignPatchSchema = z
  .object({
    expectedUpdatedAt: z.iso.datetime(),
    x: z.number().min(0).max(1).optional(),
    y: z.number().min(0).max(1).optional(),
    code: text(40).pipe(z.string().min(1)).optional(),
    content: text(200).optional(),
    mounting: appearance.mounting.optional(),
    function: appearance.function.optional(),
    colour: appearance.colour.optional(),
    orientation: appearance.orientation.optional(),
  })
  .strict()
  .refine(
    (value) => (value.x === undefined) === (value.y === undefined),
    'Provide both coordinates',
  )
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'expectedUpdatedAt'),
    'Provide a changed field',
  );
export const planSignDeleteSchema = z
  .object({ expectedUpdatedAt: z.iso.datetime() })
  .strict();
export const planSignSchema = z
  .object({
    id: z.uuid(),
    fileId: z.uuid().nullable(),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    code: text(40).pipe(z.string().min(1)),
    content: text(200),
    updatedAt: z.iso.datetime(),
    ...appearance,
    // Normalize legacy storage/response values without accepting legacy writes.
    function: z.union([
      signFunctionSchema,
      z.literal('Wayfinder').transform(() => 'Directional' as const),
    ]),
  })
  .strict();
export const planSignsResponseSchema = z
  .object({
    canManageSigns: z.boolean(),
    documentsEnabled: z.boolean().optional(),
    photosEnabled: z.boolean().optional(),
    commentsEnabled: z.boolean().optional(),
    signs: z.array(planSignSchema).max(5000),
  })
  .strict();
export type PlanSign = z.infer<typeof planSignSchema>;
export type PlanSignCreate = z.infer<typeof planSignCreateSchema>;
export type PlanSignPatch = z.infer<typeof planSignPatchSchema>;
export type PlanSignsResponse = z.infer<typeof planSignsResponseSchema>;
