/** @spec sign-documents REQ-004..006 */
import {
  signDocumentIntentSchema,
  signDocumentSchema,
  signDocumentsSchema,
  type SignDocumentUpload,
} from '@hansel/contracts';
export class SignDocumentRequestError extends Error {
  constructor(public status: number) {
    super(`Document request failed (${String(status)})`);
  }
}
export function createSignDocumentsApi(siteId: string, baseUrl: string) {
  const path = `${baseUrl}/api/sites/${siteId}/signs`;
  async function request(signId: string, suffix: string, body?: unknown) {
    const response = await fetch(`${path}/${signId}/documents${suffix}`, {
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
    if (!response.ok) throw new SignDocumentRequestError(response.status);
    return response;
  }
  return {
    list: async (signId: string, cursor?: string) =>
      signDocumentsSchema.parse(
        await (
          await request(
            signId,
            cursor ? `?cursor=${encodeURIComponent(cursor)}` : '',
          )
        ).json(),
      ),
    initiate: async (signId: string, input: SignDocumentUpload) =>
      signDocumentIntentSchema.parse(
        await (await request(signId, '', input)).json(),
      ),
    complete: async (signId: string, id: string) =>
      signDocumentSchema.parse(
        await (await request(signId, `/${id}`, {})).json(),
      ),
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
export type SignDocumentsApi = ReturnType<typeof createSignDocumentsApi>;
export function transferDocument(
  url: string,
  headers: Record<string, string>,
  file: File,
  progress: (value: number) => void,
  signal: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => {
      xhr.abort();
    };
    const finish = (error?: Error) => {
      signal.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve();
    };
    xhr.open('PUT', url);
    xhr.timeout = 120_000;
    for (const [key, value] of Object.entries(headers))
      xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        progress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      finish(
        xhr.status >= 200 && xhr.status < 300
          ? undefined
          : new Error('Upload failed'),
      );
    };
    xhr.onerror = () => {
      finish(new Error('Upload failed'));
    };
    xhr.ontimeout = () => {
      finish(new Error('Upload timed out'));
    };
    xhr.onabort = () => {
      finish(new Error('Upload interrupted'));
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) finish(new Error('Upload interrupted'));
    else xhr.send(file);
  });
}
