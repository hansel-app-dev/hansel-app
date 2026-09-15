/** @spec sign-comments REQ-007,011 */
import { useEffect, useRef, useState } from 'react';
import type { CommentAttachment } from '@hansel/contracts';
import {
  CommentRequestError,
  type SignCommentsApi,
} from './sign-comments-api.js';
import { transferDocument } from './sign-documents-api.js';
interface Transfer {
  key: string;
  file: File;
  state: 'queued' | 'uploading' | 'error' | 'complete';
  progress: number;
  id?: string;
  uploaded?: boolean;
  attachment?: CommentAttachment;
  error?: string;
  removed?: boolean;
  controller: AbortController;
}
export function useCommentAttachments(api: SignCommentsApi, signId: string) {
  const queue = useRef<Transfer[]>([]),
    active = useRef(0),
    mounted = useRef(true);
  const [items, setItems] = useState<Transfer[]>([]);
  const [error, setError] = useState('');
  const publish = () => {
    if (mounted.current) setItems([...queue.current]);
  };
  const discard = (id: string) => {
    void api.discard(signId, id).catch(() => {
      /* Durable draft expiry remains the cleanup fallback. */
    });
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const item of queue.current) {
        item.removed = true;
        item.controller.abort();
        if (item.id) discard(item.id);
      }
      queue.current = [];
    };
  }, []);
  async function run(item: Transfer) {
    try {
      if (!item.uploaded) {
        const checksum = btoa(
          String.fromCharCode(
            ...new Uint8Array(
              await crypto.subtle.digest(
                'SHA-256',
                await item.file.arrayBuffer(),
              ),
            ),
          ),
        );
        if (item.removed) return;
        const intent = await api.initiate(signId, {
          idempotencyKey: item.key,
          filename: item.file.name,
          mediaType: item.file.type as
            'image/png' | 'image/jpeg' | 'application/pdf',
          byteSize: item.file.size,
          checksumSha256: checksum,
        });
        item.id = intent.id;
        // Removal can occur while the intent request is in flight.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (item.removed) {
          discard(intent.id);
          return;
        }
        if (!intent.completed) {
          if (!intent.uploadUrl || !intent.headers)
            throw new Error('Invalid upload response');
          await transferDocument(
            intent.uploadUrl,
            intent.headers,
            item.file,
            (value) => {
              item.progress = value;
              publish();
            },
            item.controller.signal,
          );
        }
        item.uploaded = true;
        publish();
      }
      if (!item.id || item.removed) return;
      item.attachment = await api.complete(signId, item.id);
      // Removal may happen while verification is in flight.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (item.removed) {
        discard(item.id);
        return;
      }
      item.state = 'complete';
    } catch (reason) {
      item.state = 'error';
      item.error = 'Upload failed. Please retry.';
      if (reason instanceof CommentRequestError && reason.status === 422) {
        if (item.id) discard(item.id);
        delete item.id;
        delete item.uploaded;
        item.key = crypto.randomUUID();
        item.error = 'Invalid or expired file. Remove it or retry.';
      }
    } finally {
      active.current--;
      publish();
      pump();
    }
  }
  function pump() {
    if (!mounted.current) return;
    while (active.current < 3) {
      const item = queue.current.find((row) => row.state === 'queued');
      if (!item) break;
      item.state = 'uploading';
      active.current++;
      void run(item);
    }
    publish();
  }
  return {
    items,
    error,
    busy: items.some(
      (item) => item.state === 'queued' || item.state === 'uploading',
    ),
    add: (files: File[]) => {
      setError('');
      for (const file of files) {
        if (queue.current.length >= 5) {
          setError('A comment can have up to five attachments.');
          break;
        }
        const valid =
          file.size > 0 &&
          file.size <= 5_242_880 &&
          ['image/png', 'image/jpeg', 'application/pdf'].includes(file.type);
        queue.current.push({
          key: crypto.randomUUID(),
          file,
          state: valid ? 'queued' : 'error',
          progress: 0,
          controller: new AbortController(),
          ...(valid
            ? {}
            : { error: 'Choose a nonempty PNG, JPG or PDF up to 5 MB.' }),
        });
      }
      pump();
    },
    remove: (key: string) => {
      const item = queue.current.find((row) => row.key === key);
      if (!item) return;
      item.removed = true;
      item.controller.abort();
      if (item.id) discard(item.id);
      queue.current = queue.current.filter((row) => row !== item);
      setError('');
      publish();
    },
    retry: (key: string) => {
      const item = queue.current.find((row) => row.key === key);
      if (item?.state !== 'error' || item.error?.startsWith('Choose')) return;
      item.state = 'queued';
      item.controller = new AbortController();
      delete item.error;
      pump();
    },
    committed: () => {
      queue.current = [];
      setError('');
      publish();
    },
  };
}
