import { createPlanAreasApi, type PlanAreasApi } from './plan-areas-api.js';
import {
  planSignSchema,
  planSignsResponseSchema,
  type PlanSignCreate,
  type PlanSignPatch,
} from '@hansel/contracts';
import {
  createSignDocumentsApi,
  type SignDocumentsApi,
} from './sign-documents-api.js';
import { createSignPhotosApi, type SignPhotosApi } from './sign-photos-api.js';
import {
  createSignCommentsApi,
  type SignCommentsApi,
} from './sign-comments-api.js';

export class PlanSignRequestError extends Error {
  constructor(public status: number) {
    super('plan_sign_request_failed');
  }
}
export function createPlanSignsApi(
  siteId: string,
  planId: string,
  baseUrl: string,
) {
  const path = `${baseUrl}/api/sites/${siteId}/allocation-plans/${planId}/signs`;
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
    if (!response.ok) throw new PlanSignRequestError(response.status);
    return (await response.json()) as unknown;
  }
  return {
    areas: createPlanAreasApi(siteId, planId, baseUrl),
    documents: createSignDocumentsApi(siteId, baseUrl),
    photos: createSignPhotosApi(siteId, baseUrl),
    comments: createSignCommentsApi(siteId, baseUrl),
    load: async (fileId: string | null) =>
      planSignsResponseSchema.parse(
        await request(fileId ? `?fileId=${encodeURIComponent(fileId)}` : ''),
      ),
    create: async (input: PlanSignCreate) =>
      planSignSchema.parse(await request('', 'POST', input)),
    update: async (id: string, input: PlanSignPatch) =>
      planSignSchema.parse(await request(`/${id}`, 'PATCH', input)),
    remove: async (id: string, expectedUpdatedAt: string) => {
      await request(`/${id}`, 'DELETE', { expectedUpdatedAt });
    },
  };
}
export type PlanSignsApi = Omit<
  ReturnType<typeof createPlanSignsApi>,
  'documents' | 'photos' | 'comments' | 'areas'
> & {
  areas?: PlanAreasApi;
  documents?: SignDocumentsApi;
  photos?: SignPhotosApi;
  comments?: SignCommentsApi;
};
