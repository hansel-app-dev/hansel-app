/** @spec allocation-plan-add-area REQ-001,004,007..010 */
import { z } from 'zod';
import { planSignOrientationSchema } from './plan-signs.js';
const text = (max: number) =>
  z
    .string()
    .trim()
    .transform((s) => s.normalize('NFC'))
    .refine((s) => Array.from(s).length <= max);
const coordinate = z.number().min(0).max(1);
const geometry = {
  x: coordinate,
  y: coordinate,
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
};
export const areaWithinBounds = (a: {
  x: number;
  y: number;
  width: number;
  height: number;
}) => a.x + a.width <= 1 && a.y + a.height <= 1;
export const planAreaCreateSchema = z
  .object({
    fileId: z.uuid().nullable(),
    ...geometry,
    idempotencyKey: z.uuid(),
  })
  .strict()
  .refine(areaWithinBounds, 'Area must fit within drawing');
export const planAreaPatchSchema = z
  .object({
    expectedUpdatedAt: z.iso.datetime(),
    x: coordinate.optional(),
    y: coordinate.optional(),
    width: geometry.width.optional(),
    height: geometry.height.optional(),
    code: text(40)
      .refine((s) => s.length > 0)
      .optional(),
    content: text(200).optional(),
    orientation: planSignOrientationSchema.optional(),
  })
  .strict()
  .refine(
    (v) => (v.x === undefined) === (v.y === undefined),
    'Provide both coordinates',
  )
  .refine((v) => {
    if (v.width === undefined && v.height === undefined) return true;
    return (
      v.x !== undefined &&
      v.y !== undefined &&
      v.width !== undefined &&
      v.height !== undefined &&
      areaWithinBounds({ x: v.x, y: v.y, width: v.width, height: v.height })
    );
  }, 'Provide complete bounded resize geometry')
  .refine((v) => Object.keys(v).length > 1, 'Provide a changed field');
export const planAreaDeleteSchema = z
  .object({ expectedUpdatedAt: z.iso.datetime() })
  .strict();
export const planAreaSchema = z
  .object({
    id: z.uuid(),
    fileId: z.uuid().nullable(),
    ...geometry,
    code: text(40).refine((s) => s.length > 0),
    content: text(200),
    orientation: planSignOrientationSchema,
    type: z.literal('Floor'),
    function: z.literal('Environmental'),
    colour: z.literal('Blue'),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .refine(areaWithinBounds);
export const planAreasResponseSchema = z
  .object({
    canManageAreas: z.boolean(),
    areas: z.array(planAreaSchema).max(5000),
  })
  .strict();
export type PlanArea = z.infer<typeof planAreaSchema>;
export type PlanAreaCreate = z.infer<typeof planAreaCreateSchema>;
export type PlanAreaPatch = z.infer<typeof planAreaPatchSchema>;
export type PlanAreasResponse = z.infer<typeof planAreasResponseSchema>;
