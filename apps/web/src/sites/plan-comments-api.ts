/** @spec allocation-plan-comments REQ-001,005..010 */
import {
  planCommentMarkersSchema,
  planCommentHistorySchema,
  planCommentSubmissionSchema,
  planCommentThreadSchema,
  commentPeopleSchema,
  commentAttachmentIntentSchema,
  commentAttachmentSchema,
  type CommentCursor,
  type PlanCommentCreate,
  type SignDocumentUpload,
} from '@hansel/contracts';
import { CommentRequestError } from './sign-comments-api.js';
export function createPlanCommentsApi(
  siteId: string,
  planId: string,
  baseUrl: string,
) {
  async function request(
    fileId: string | null,
    suffix: string,
    method = 'GET',
    body?: unknown,
  ) {
    const r = await fetch(
      `${baseUrl}/api/sites/${siteId}/allocation-plans/${planId}/files/${fileId ?? 'legacy'}/comments${suffix}`,
      {
        method,
        credentials: 'include',
        signal: AbortSignal.timeout(30000),
        ...(body === undefined
          ? {}
          : {
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
            }),
      },
    );
    if (!r.ok) {
      const data = (await r.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new CommentRequestError(
        r.status,
        data?.error ?? 'comment_request_failed',
      );
    }
    return r;
  }
  const query = (cursor?: CommentCursor) =>
    cursor ? `cursor=${encodeURIComponent(JSON.stringify(cursor))}` : '';
  return {
    markers: async (
      fileId: string | null,
      resolved = false,
      cursor?: CommentCursor,
    ) =>
      planCommentMarkersSchema.parse(
        await (
          await request(
            fileId,
            `?resolved=${String(resolved)}&${query(cursor)}`,
          )
        ).json(),
      ),
    history: async (
      fileId: string | null,
      id: string,
      cursor?: CommentCursor,
    ) =>
      planCommentHistorySchema.parse(
        await (await request(fileId, `/${id}?${query(cursor)}`)).json(),
      ),
    submit: async (fileId: string | null, input: PlanCommentCreate) =>
      planCommentSubmissionSchema.parse(
        await (await request(fileId, '', 'POST', input)).json(),
      ),
    state: async (
      fileId: string | null,
      id: string,
      resolved: boolean,
      expectedUpdatedAt: string,
    ) =>
      planCommentThreadSchema.parse(
        await (
          await request(fileId, `/${id}/state`, 'PUT', {
            resolved,
            expectedUpdatedAt,
          })
        ).json(),
      ),
    /** @spec allocation-plan-comment-moving REQ-005,008 */
    position: async (
      fileId: string | null,
      id: string,
      x: number,
      y: number,
      expectedUpdatedAt: string,
    ) =>
      planCommentThreadSchema.parse(
        await (
          await request(fileId, `/${id}/position`, 'PUT', {
            x,
            y,
            expectedUpdatedAt,
          })
        ).json(),
      ),
    people: async (fileId: string | null, q: string, cursor?: string) =>
      commentPeopleSchema.parse(
        await (
          await request(
            fileId,
            `/people?${new URLSearchParams({ q, ...(cursor ? { cursor } : {}) }).toString()}`,
          )
        ).json(),
      ),
    initiate: async (fileId: string | null, input: SignDocumentUpload) =>
      commentAttachmentIntentSchema.parse(
        await (await request(fileId, '/attachments', 'POST', input)).json(),
      ),
    complete: async (fileId: string | null, id: string) =>
      commentAttachmentSchema.parse(
        await (await request(fileId, `/attachments/${id}`, 'POST', {})).json(),
      ),
    discard: async (fileId: string | null, id: string) => {
      await request(fileId, `/attachments/${id}`, 'DELETE', {});
    },
    thumbnail: async (fileId: string | null, id: string) =>
      (await request(fileId, `/attachments/${id}/thumbnail`)).blob(),
    download: async (fileId: string | null, id: string, filename: string) => {
      const bytes = await (
        await request(fileId, `/attachments/${id}/download`)
      ).blob();
      const url = URL.createObjectURL(bytes),
        link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60000);
    },
  };
}
export type PlanCommentsApi = ReturnType<typeof createPlanCommentsApi>;
