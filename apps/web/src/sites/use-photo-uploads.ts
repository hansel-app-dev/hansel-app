/** @spec sign-photos REQ-007 */
import { useEffect, useRef, useState } from 'react';
import { type SignPhoto } from '@hansel/contracts';
import { transferDocument } from './sign-documents-api.js';
import {
  SignPhotoRequestError,
  type SignPhotosApi,
} from './sign-photos-api.js';
interface Upload {
  key: string;
  file: File;
  state: 'queued' | 'uploading' | 'error';
  progress: number;
  error?: string;
  id?: string;
  uploaded?: boolean;
}
export function usePhotoUploads(
  api: SignPhotosApi,
  signId: string,
  onComplete: (photo: SignPhoto) => void,
) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const queue = useRef<Upload[]>([]);
  const active = useRef(0);
  const mounted = useRef(true);
  const controller = useRef(new AbortController());
  const completed = useRef(onComplete);
  completed.current = onComplete;
  const busy = uploads.some((item) => item.state !== 'error');
  useEffect(() => {
    mounted.current = true;
    controller.current = new AbortController();
    const leave = (event: BeforeUnloadEvent) => {
      if (queue.current.some((item) => item.state !== 'error'))
        event.preventDefault();
    };
    window.addEventListener('beforeunload', leave);
    return () => {
      mounted.current = false;
      controller.current.abort();
      window.removeEventListener('beforeunload', leave);
    };
  }, []);
  const publish = () => {
    if (mounted.current) setUploads([...queue.current]);
  };
  async function upload(item: Upload) {
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
        if (!mounted.current) return;
        const intent = await api.initiate(signId, {
          idempotencyKey: item.key,
          filename: item.file.name,
          mediaType: item.file.type as 'image/png' | 'image/jpeg',
          byteSize: item.file.size,
          checksumSha256: checksum,
        });
        item.id = intent.id;
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
            controller.current.signal,
          );
        }
        item.uploaded = true;
        publish();
      }
      if (!item.id || !mounted.current) return;
      const photo = await api.complete(signId, item.id);
      // Unmount can occur while awaiting completion.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!mounted.current) return;
      completed.current(photo);
      queue.current = queue.current.filter((row) => row !== item);
    } catch (error) {
      item.state = 'error';
      item.error = 'Upload failed. Please retry.';
      if (error instanceof SignPhotoRequestError && error.status === 422) {
        item.key = crypto.randomUUID();
        delete item.id;
        delete item.uploaded;
        item.error =
          'Image invalid or upload expired. Choose another image or retry.';
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
      const next = queue.current.find((item) => item.state === 'queued');
      if (!next) break;
      next.state = 'uploading';
      active.current++;
      void upload(next);
    }
    publish();
  }
  return {
    uploads,
    busy,
    add: (files: File[]) => {
      for (const file of files) {
        if (
          queue.current.some(
            (item) =>
              item.file.name === file.name &&
              item.file.size === file.size &&
              item.state !== 'error',
          )
        )
          continue;
        const valid =
          file.size > 0 &&
          file.size <= 5_242_880 &&
          ['image/png', 'image/jpeg'].includes(file.type);
        queue.current.push({
          key: crypto.randomUUID(),
          file,
          progress: 0,
          state: valid ? 'queued' : 'error',
          ...(valid
            ? {}
            : { error: 'Choose a nonempty PNG or JPG up to 5 MB.' }),
        });
      }
      pump();
    },
    retry: (key: string) => {
      const item = queue.current.find((row) => row.key === key);
      if (item?.state === 'error') {
        item.state = 'queued';
        delete item.error;
        pump();
      }
    },
  };
}
