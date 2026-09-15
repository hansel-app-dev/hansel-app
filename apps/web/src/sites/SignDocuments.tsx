/** @spec sign-documents REQ-001..006 */
import { useEffect, useRef, useState } from 'react';
import { type SignDocument } from '@hansel/contracts';
import {
  transferDocument,
  SignDocumentRequestError,
  type SignDocumentsApi,
} from './sign-documents-api.js';

interface Transfer {
  key: string;
  file: File;
  state: 'queued' | 'uploading' | 'error';
  progress: number;
  error?: string;
  uploadId?: string;
  uploaded?: boolean;
}
const button =
  'h-8 rounded border border-[#d4d4d8] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#4096ff] disabled:cursor-not-allowed disabled:opacity-60';
export function SignDocuments({
  api,
  signId,
  canManage,
  onBusyChange,
}: {
  api: SignDocumentsApi;
  signId: string;
  canManage: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [documents, setDocuments] = useState<SignDocument[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const queue = useRef<Transfer[]>([]);
  const active = useRef(0);
  const mounted = useRef(true);
  const abort = useRef(new AbortController());
  const busyCallback = useRef(onBusyChange);
  busyCallback.current = onBusyChange;
  function publish() {
    if (!mounted.current) return;
    setTransfers([...queue.current]);
    busyCallback.current(queue.current.some((item) => item.state !== 'error'));
  }
  async function load(next?: string) {
    setLoading(true);
    setError('');
    try {
      const result = await api.list(signId, next);
      if (!mounted.current) return;
      setDocuments((previous) =>
        [...previous, ...result.documents].filter(
          (item, i, rows) => rows.findIndex((row) => row.id === item.id) === i,
        ),
      );
      setCursor(result.nextCursor);
    } catch {
      if (mounted.current)
        setError('We couldn’t load documents. Please try again.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    abort.current = new AbortController();
    void load();
    const leaving = (event: BeforeUnloadEvent) => {
      if (queue.current.some((item) => item.state !== 'error'))
        event.preventDefault();
    };
    window.addEventListener('beforeunload', leaving);
    return () => {
      mounted.current = false;
      abort.current.abort();
      busyCallback.current(false);
      window.removeEventListener('beforeunload', leaving);
    };
    // The parent keys this component by Sign and API identity is stable for its lifetime.
  }, []);
  async function upload(item: Transfer) {
    try {
      if (!item.uploadId) {
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
          byteSize: item.file.size,
          mediaType: item.file.type as
            'image/png' | 'image/jpeg' | 'application/pdf',
          checksumSha256: checksum,
        });
        item.uploadId = intent.id;
        item.uploaded = intent.completed;
        if (!intent.completed) {
          if (!intent.uploadUrl || !intent.headers)
            throw new Error('Upload unavailable');
          await transferDocument(
            intent.uploadUrl,
            intent.headers,
            item.file,
            (value) => {
              item.progress = value;
              publish();
            },
            abort.current.signal,
          );
          item.uploaded = true;
        }
      }
      if (!mounted.current || !item.uploadId) return;
      const result = await api.complete(signId, item.uploadId);
      // The ref can change while completion is awaiting the network.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!mounted.current) return;
      setDocuments((previous) => [
        ...previous.filter((row) => row.id !== result.id),
        result,
      ]);
      queue.current = queue.current.filter((row) => row !== item);
    } catch (failure) {
      item.state = 'error';
      item.error = 'Upload failed. Please retry.';
      if (
        failure instanceof SignDocumentRequestError &&
        failure.status === 422
      ) {
        item.key = crypto.randomUUID();
        delete item.uploadId;
        delete item.uploaded;
      }
      if (!item.uploaded) delete item.uploadId;
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
      void upload(item);
    }
    publish();
  }
  function add(files: File[]) {
    if (!canManage) return;
    for (const file of files) {
      if (
        queue.current.some(
          (row) =>
            row.file.name === file.name &&
            row.file.size === file.size &&
            row.state !== 'error',
        )
      )
        continue;
      const valid =
        file.size > 0 &&
        file.size <= 5_242_880 &&
        ['image/png', 'image/jpeg', 'application/pdf'].includes(file.type);
      queue.current.push({
        key: crypto.randomUUID(),
        file,
        state: valid ? 'queued' : 'error',
        progress: 0,
        ...(valid
          ? {}
          : { error: 'Choose a nonempty PNG, JPG or PDF up to 5 MB.' }),
      });
    }
    pump();
  }
  return (
    <div
      role="tabpanel"
      aria-label="Sign documents"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 overflow-y-auto pl-[23px] pr-6 pt-[22px] pb-4">
        <p className="mb-5 text-[13px] leading-[15px] text-[#72727e]">
          <strong>Link relevant documents</strong>
          <br />
          Link documents to this sign from your local files or organisation’s
          library.
        </p>
        <div className="space-y-1">
          {documents.map((file) => (
            <div
              key={file.id}
              className="group flex h-9 items-center gap-2 rounded-md hover:bg-[#f4f4f5] focus-within:bg-[#f4f4f5]"
            >
              <button
                type="button"
                title={file.filename}
                aria-label={`Download ${file.filename}`}
                className="flex min-w-0 flex-1 items-center gap-2 rounded text-left text-[13px] focus-visible:outline-2 focus-visible:outline-[#4096ff]"
                onClick={() => {
                  void api
                    .download(signId, file.id, file.filename)
                    .catch(() => {
                      if (mounted.current)
                        setError(
                          'Download failed. Click the document to retry.',
                        );
                    });
                }}
              >
                <DocumentIcon pdf={file.mediaType === 'application/pdf'} />
                <span className="truncate">{file.filename}</span>
              </button>
              <button
                type="button"
                disabled
                aria-label="Document options unavailable"
                className="mr-2 w-5 text-lg text-[#72727e] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                ⋮
              </button>
            </div>
          ))}
          {transfers.map((item) => (
            <div
              key={item.key}
              className="rounded border border-[#d4d4d8] p-2 text-xs"
              aria-live="polite"
            >
              <p className="truncate" title={item.file.name}>
                {item.file.name}
              </p>
              {item.state === 'error' ? (
                <>
                  <p role="alert" className="mt-1 text-red-700">
                    {item.error}
                  </p>
                  {item.error?.startsWith('Upload failed') && (
                    <button
                      type="button"
                      className="mt-1 underline"
                      onClick={() => {
                        item.state = 'queued';
                        delete item.error;
                        pump();
                      }}
                    >
                      Retry {item.file.name}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p>
                    {item.state === 'queued'
                      ? 'Queued'
                      : item.uploaded
                        ? 'Verifying…'
                        : `Uploading… ${String(item.progress)}%`}
                  </p>
                  <progress
                    className="h-1 w-full"
                    max={100}
                    value={item.progress}
                    aria-label={`Uploading ${item.file.name}`}
                  />
                </>
              )}
            </div>
          ))}
        </div>
        {loading && (
          <p role="status" className="mt-3 text-xs text-[#72727e]">
            Loading documents…
          </p>
        )}
        {!loading && !error && !documents.length && !transfers.length && (
          <p className="text-xs text-[#72727e]">No documents linked yet.</p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-xs text-red-700">
            {error}{' '}
            {error.includes('load') && (
              <button
                type="button"
                className="underline"
                onClick={() => {
                  void load();
                }}
              >
                Retry
              </button>
            )}
          </p>
        )}
        {cursor && (
          <button
            type="button"
            disabled={loading}
            className={`${button} mt-3`}
            onClick={() => {
              void load(cursor);
            }}
          >
            Load more
          </button>
        )}
      </div>
      <div className="shrink-0 border-t border-[#e2e2e7] bg-[#f8f9fb] pl-[23px] pr-6 pt-6 pb-5">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (canManage) setDragging(true);
          }}
          onDragLeave={() => {
            setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            add(Array.from(event.dataTransfer.files));
          }}
          className={`relative flex h-[232px] flex-col items-center rounded-md border border-transparent px-[23px] pt-[29px] ${dragging ? 'bg-blue-50' : ''}`}
        >
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
            width="100%"
            height="100%"
          >
            <rect
              x="0.5"
              y="0.5"
              width="calc(100% - 1px)"
              height="calc(100% - 1px)"
              rx="6"
              fill="none"
              stroke="#64748b"
              strokeDasharray="12 8"
            />
          </svg>
          <svg
            aria-hidden="true"
            width="36"
            height="36"
            viewBox="0 0 36 36"
            fill="none"
            stroke="#64748b"
            strokeWidth="2"
          >
            <path d="M6 2h17l7 8v24H6V2Zm17 0v9h7M18 28V17m-6 6 6-6 6 6" />
          </svg>
          <p className="mt-4 whitespace-nowrap text-sm">
            Drag your file(s) here to get started
          </p>
          <div className="my-2 flex w-full items-center gap-2 text-sm">
            <span className="h-px flex-1 bg-[#dfe2e7]" />
            or
            <span className="h-px flex-1 bg-[#dfe2e7]" />
          </div>
          <input
            ref={input}
            type="file"
            multiple
            accept="image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf"
            aria-label="Upload documents"
            className="sr-only"
            disabled={!canManage}
            onChange={(event) => {
              add(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={!canManage}
            className={`${button} w-full shrink-0`}
            onClick={() => {
              input.current?.click();
            }}
          >
            Browse local files
          </button>
          <button
            type="button"
            disabled
            className={`${button} mt-2 w-full shrink-0 border-transparent bg-[#475569] text-white`}
          >
            Library files
          </button>
        </div>
        <p className="mt-3 whitespace-nowrap text-[12px] leading-4 text-[#72727e]">
          PNG, JPG and PDF supported and up to 5mb.
        </p>
      </div>
    </div>
  );
}
function DocumentIcon({ pdf }: { pdf: boolean }) {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded bg-[#f4f4f5]">
      <svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="#334155"
        strokeWidth="1.3"
      >
        <path d="M5 2h12v14H5zM2 5v14h12" />
        <text
          x="6"
          y="11"
          stroke="none"
          fill="#334155"
          fontSize="5"
          fontWeight="bold"
        >
          {pdf ? 'PDF' : 'IMG'}
        </text>
      </svg>
    </span>
  );
}
