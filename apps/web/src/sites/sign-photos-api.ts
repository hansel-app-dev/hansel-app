import {
  createLibraryFilesApi,
  type LibraryFilesApi,
} from './library-files-api.js';
import type { LibrarySelection } from '@hansel/contracts';
/** @spec sign-photos REQ-004..006 */
import {
  signPhotoIntentSchema,
  signPhotoSchema,
  signPhotosSchema,
  type SignPhotoUpload,
} from '@hansel/contracts';
export class SignPhotoRequestError extends Error {
  constructor(public status: number) {
    super(`Document request failed (${String(status)})`);
  }
}
export function createSignPhotosApi(siteId: string, baseUrl: string) {
  const path = `${baseUrl}/api/sites/${siteId}/signs`;
  async function request(
    signId: string,
    suffix: string,
    body?: unknown,
    method = 'POST',
  ) {
    const response = await fetch(`${path}/${signId}/photos${suffix}`, {
      credentials: 'include',
      signal: AbortSignal.timeout(30_000),
      ...(body === undefined
        ? {}
        : {
            method,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }),
    });
    if (!response.ok) throw new SignPhotoRequestError(response.status);
    return response;
  }
  const files = createLibraryFilesApi(baseUrl);
  return {
    library: {
      files,
      link: (signId: string, input: LibrarySelection) =>
        files.link(siteId, signId, 'photos', input),
    },
    list: async (signId: string, cursor?: string) =>
      signPhotosSchema.parse(
        await (
          await request(
            signId,
            cursor ? `?cursor=${encodeURIComponent(cursor)}` : '',
          )
        ).json(),
      ),
    initiate: async (signId: string, input: SignPhotoUpload) =>
      signPhotoIntentSchema.parse(
        await (await request(signId, '', input)).json(),
      ),
    complete: async (signId: string, id: string) =>
      signPhotoSchema.parse(await (await request(signId, `/${id}`, {})).json()),
    async thumbnail(signId: string, id: string) {
      return (await request(signId, `/${id}/thumbnail`)).blob();
    },
    async remove(signId: string, id: string) {
      await request(signId, `/${id}`, {}, 'DELETE');
    },
    async download(signId: string, id: string, filename: string) {
      const response = await request(signId, `/${id}/download`);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60_000);
    },
  };
}
export type SignPhotosApi = Omit<
  ReturnType<typeof createSignPhotosApi>,
  'library'
> & {
  library?: {
    files: LibraryFilesApi;
    link: (
      signId: string,
      input: LibrarySelection,
    ) => ReturnType<LibraryFilesApi['link']>;
  };
};
