/** @spec allocation-plan-add-area REQ-001,004,008,010 */
import {
  planAreaSchema,
  planAreasResponseSchema,
  type PlanAreaCreate,
  type PlanAreaPatch,
} from '@hansel/contracts';
export class PlanAreaRequestError extends Error {
  constructor(public status: number) {
    super('plan_area_request_failed');
  }
}
export function createPlanAreasApi(
  siteId: string,
  planId: string,
  baseUrl: string,
) {
  const path = `${baseUrl}/api/sites/${siteId}/allocation-plans/${planId}/areas`;
  async function request(suffix: string, method = 'GET', body?: unknown) {
    const response = await fetch(`${path}${suffix}`, {
      method,
      credentials: 'include',
      signal: AbortSignal.timeout(15000),
      ...(body === undefined
        ? {}
        : {
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }),
    });
    if (!response.ok) throw new PlanAreaRequestError(response.status);
    return (await response.json()) as unknown;
  }
  return {
    load: async (fileId: string | null) =>
      planAreasResponseSchema.parse(
        await request(fileId ? `?fileId=${encodeURIComponent(fileId)}` : ''),
      ),
    create: async (input: PlanAreaCreate) =>
      planAreaSchema.parse(await request('', 'POST', input)),
    update: async (id: string, input: PlanAreaPatch) =>
      planAreaSchema.parse(await request(`/${id}`, 'PATCH', input)),
    remove: async (id: string, expectedUpdatedAt: string) => {
      await request(`/${id}`, 'DELETE', { expectedUpdatedAt });
    },
  };
}
export type PlanAreasApi = ReturnType<typeof createPlanAreasApi>;
