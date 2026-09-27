/** @spec library-files REQ-003..008 */
import {
  libraryFilesSchema,
  finalizeAllocationPlanUploadResponseSchema,
  libraryDocumentsResponseSchema,
  libraryPhotosResponseSchema,
  type LibraryQuery,
  type LibrarySelection,
  type LibraryPlan,
  type SignDocument,
} from '@hansel/contracts';
import { DashboardAuthenticationRequiredError } from '../api.js';
export function createLibraryFilesApi(
  baseUrl: string,
  onAuthenticationRequired?: () => void,
) {
  async function request(path: string, body?: unknown) {
    const response = await fetch(`${baseUrl}/api/${path}`, {
      credentials: 'include',
      signal: AbortSignal.timeout(30_000),
      ...(body === undefined
        ? {}
        : {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }),
    });
    if (response.status === 401) {
      onAuthenticationRequired?.();
      throw new DashboardAuthenticationRequiredError();
    }
    if (!response.ok)
      throw new Error('Library files are unavailable. Please try again.');
    return response;
  }
  return {
    async list(query: LibraryQuery) {
      const params = new URLSearchParams({ q: query.q, kind: query.kind });
      if (query.cursor) params.set('cursor', query.cursor);
      return libraryFilesSchema.parse(
        await (await request(`library-files?${params}`)).json(),
      );
    },
    async download(id: string, filename: string) {
      const response = await request(`library-files/${id}/download`),
        url = URL.createObjectURL(await response.blob()),
        link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60_000);
    },
    async thumbnail(id: string) {
      return (await request(`library-files/${id}/thumbnail`)).blob();
    },
    async link(
      siteId: string,
      signId: string,
      kind: 'documents' | 'photos',
      input: LibrarySelection,
    ): Promise<{ items: SignDocument[] }> {
      const schema =
        kind === 'documents'
          ? libraryDocumentsResponseSchema
          : libraryPhotosResponseSchema;
      return schema.parse(
        await (
          await request(
            `sites/${siteId}/signs/${signId}/library-${kind}`,
            input,
          )
        ).json(),
      );
    },
    async createPlan(siteId: string, input: LibraryPlan) {
      return finalizeAllocationPlanUploadResponseSchema.parse(
        await (await request(`sites/${siteId}/library-plans`, input)).json(),
      );
    },
  };
}
export type LibraryFilesApi = ReturnType<typeof createLibraryFilesApi>;
