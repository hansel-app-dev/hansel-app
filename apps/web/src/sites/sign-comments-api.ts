/** @spec sign-comments REQ-001,004..012 */
import {
  signCommentsPageSchema,
  signCommentSchema,
  commentPeopleSchema,
  commentAttachmentSchema,
  commentAttachmentIntentSchema,
  type SignCommentCreate,
  type CommentCursor,
  type SignDocumentUpload,
  type commentEmoji,
} from '@hansel/contracts';
export class CommentRequestError extends Error {
  constructor(
    public status: number,
    public category: string,
  ) {
    super(category);
  }
}
export function createSignCommentsApi(siteId: string, baseUrl: string) {
  async function request(
    signId: string,
    suffix: string,
    method = 'GET',
    body?: unknown,
  ) {
    const response = await fetch(
      `${baseUrl}/api/sites/${siteId}/signs/${signId}/comments${suffix}`,
      {
        method,
        credentials: 'include',
        signal: AbortSignal.timeout(30_000),
        ...(body === undefined
          ? {}
          : {
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
            }),
      },
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new CommentRequestError(
        response.status,
        data?.error ?? 'comment_request_failed',
      );
    }
    return response;
  }
  return {
    list: async (
      signId: string,
      parentId: string | null = null,
      cursor?: CommentCursor,
    ) => {
      const query = new URLSearchParams();
      if (parentId) query.set('parentId', parentId);
      if (cursor) query.set('cursor', JSON.stringify(cursor));
      return signCommentsPageSchema.parse(
        await (await request(signId, `?${query.toString()}`)).json(),
      );
    },
    submit: async (signId: string, input: SignCommentCreate) =>
      signCommentSchema.parse(
        await (await request(signId, '', 'POST', input)).json(),
      ),
    people: async (signId: string, q: string, cursor?: string) => {
      const query = new URLSearchParams({ q });
      if (cursor) query.set('cursor', cursor);
      return commentPeopleSchema.parse(
        await (await request(signId, `/people?${query.toString()}`)).json(),
      );
    },
    react: async (
      signId: string,
      id: string,
      emoji: (typeof commentEmoji)[number],
      selected: boolean,
    ) =>
      signCommentSchema.parse(
        await (
          await request(signId, `/${id}/reactions`, 'PUT', { emoji, selected })
        ).json(),
      ),
    initiate: async (signId: string, input: SignDocumentUpload) =>
      commentAttachmentIntentSchema.parse(
        await (await request(signId, '/attachments', 'POST', input)).json(),
      ),
    complete: async (signId: string, id: string) =>
      commentAttachmentSchema.parse(
        await (await request(signId, `/attachments/${id}`, 'POST', {})).json(),
      ),
    discard: async (signId: string, id: string) => {
      await request(signId, `/attachments/${id}`, 'DELETE', {});
    },
    thumbnail: async (signId: string, id: string) =>
      (await request(signId, `/attachments/${id}/thumbnail`)).blob(),
    download: async (signId: string, id: string, filename: string) => {
      const bytes = await (
        await request(signId, `/attachments/${id}/download`)
      ).blob();
      const url = URL.createObjectURL(bytes);
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
export type SignCommentsApi = ReturnType<typeof createSignCommentsApi>;
