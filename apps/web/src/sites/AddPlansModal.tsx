/** @spec site-allocation-plans-add REQ-002..REQ-005, REQ-019..REQ-021 @figma 2057:3458 */
import { useEffect, useRef, useState } from 'react';
import type {
  CreateAllocationPlanUploadBatchRequest,
  CreateAllocationPlanUploadBatchResponse,
} from '@hansel/contracts';
import { AppSymbol } from '../application-shell/ApplicationShell.js';
import { Button } from '../design-system/index.js';

const allowed = new Map([
  ['image/png', ['.png']],
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['application/pdf', ['.pdf']],
]);

async function checksum(file: File): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    await file.arrayBuffer(),
  );
  let binary = '';
  for (const byte of new Uint8Array(digest))
    binary += String.fromCharCode(byte);
  return btoa(binary);
}

function validation(file: File): string | null {
  const extensions = allowed.get(file.type);
  if (
    !extensions?.some((extension) =>
      file.name.toLowerCase().endsWith(extension),
    )
  )
    return 'Choose a PNG, JPG or PDF file.';
  if (file.size < 1 || file.size > 5_242_880)
    return 'Each file must be between 1 byte and 5 MB.';
  return null;
}

export function AddPlansModal({
  createBatch,
  upload,
  finalize,
  onClose,
  onComplete,
}: {
  createBatch: (
    input: CreateAllocationPlanUploadBatchRequest,
  ) => Promise<CreateAllocationPlanUploadBatchResponse>;
  upload: (
    url: string,
    file: File,
    headers: Record<string, string>,
    options?: { onProgress: (percentage: number) => void; signal: AbortSignal },
  ) => Promise<void>;
  finalize: (uploadId: string) => Promise<void>;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [states, setStates] = useState<('queued' | 'uploading' | 'complete')[]>(
    [],
  );
  const [progress, setProgress] = useState<number[]>([]);
  const [complete, setComplete] = useState(false);
  const controllers = useRef<(AbortController | undefined)[]>([]);
  const dialog = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    dialog.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose();
    };
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('keydown', close);
    };
  }, [onClose, pending]);

  const select = (next: File[]) => {
    const problem = next.map(validation).find(Boolean);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setFiles((current) => [...current, ...next].slice(0, 20));
    setStates((current) =>
      [...current, ...next.map(() => 'queued' as const)].slice(0, 20),
    );
    setProgress((current) => [...current, ...next.map(() => 0)].slice(0, 20));
  };
  const submit = async () => {
    setPending(true);
    setError('');
    try {
      const manifest = await Promise.all(
        files.map(async (file) => ({
          filename: file.name.normalize('NFC'),
          mediaType: file.type as
            'image/png' | 'image/jpeg' | 'application/pdf',
          byteSize: file.size,
          checksumSha256: await checksum(file),
        })),
      );
      const response = await createBatch({
        idempotencyKey: crypto.randomUUID(),
        files: manifest,
      });
      for (const [index, intent] of response.uploads.entries()) {
        const file = files[index];
        if (!file) throw new Error('Upload manifest mismatch');
        setStates((current) =>
          current.map((state, item) =>
            /* v8 ignore next -- sibling rows retain their state */
            item === index ? 'uploading' : state,
          ),
        );
        const controller = new AbortController();
        controllers.current[index] = controller;
        await upload(intent.uploadUrl, file, intent.headers, {
          onProgress: (percentage) => {
            setProgress((current) =>
              current.map((value, item) =>
                /* v8 ignore next -- sibling rows retain their progress */
                item === index ? percentage : value,
              ),
            );
          },
          signal: controller.signal,
        });
        await finalize(intent.uploadId);
        setStates((current) =>
          current.map((state, item) =>
            /* v8 ignore next -- sibling rows retain their state */
            item === index ? 'complete' : state,
          ),
        );
      }
      setComplete(true);
    } catch {
      setError('We couldn’t upload every plan. Please try again.');
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/25 p-4">
      <div
        aria-labelledby="add-plans-title"
        aria-modal="true"
        className="w-full max-w-[600px] rounded-lg bg-surface shadow-xl outline-none"
        ref={dialog}
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex items-center justify-between border-b border-control-border px-6 py-4">
          <h2 className="text-[17px] font-semibold" id="add-plans-title">
            Add plans
          </h2>
          <button
            aria-label="Close Add plans"
            disabled={pending}
            onClick={onClose}
            type="button"
          >
            <AppSymbol weight={100}>close</AppSymbol>
          </button>
        </header>
        <div className="px-6 py-6">
          <p className="mb-5 text-[15px]">Add plans here</p>
          <div
            className="grid min-h-[250px] place-items-center rounded border border-dashed border-content-muted p-6 text-center"
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              select(Array.from(event.dataTransfer.files));
            }}
          >
            <div>
              <AppSymbol
                className="mx-auto !size-16 text-[64px] text-content-muted"
                weight={100}
              >
                upload_file
              </AppSymbol>
              <p className="mt-4">Drag your file(s) here to get started</p>
              <p className="my-2 text-content-muted">or</p>
              <Button
                onClick={() => picker.current?.click()}
                type="button"
                variant="secondary"
              >
                Browse files
              </Button>
              <input
                accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                className="sr-only"
                multiple
                onChange={(event) => {
                  select(Array.from(event.target.files ?? []));
                }}
                ref={picker}
                type="file"
              />
            </div>
          </div>
          {files.length > 0 ? (
            <ul aria-label="Selected plans" className="mt-4 space-y-2 text-sm">
              {files.map((file, index) => (
                <li
                  className={`rounded border px-4 py-3 ${
                    states[index] === 'complete'
                      ? 'border-[#88e6b5] bg-[#effff6]'
                      : 'border-control-border bg-surface-subtle'
                  }`}
                  key={[file.name, String(file.size), String(index)].join('-')}
                >
                  <div className="flex items-center gap-3">
                    <AppSymbol className="text-[24px]" weight={100}>
                      picture_as_pdf
                    </AppSymbol>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {file.name}
                        {states[index] === 'uploading' ? ' • Uploading…' : ''}
                      </p>
                      {states[index] === 'uploading' ? (
                        <div className="mt-1 flex items-center gap-2">
                          <span>{Number(progress[index])}%</span>
                          <progress
                            className="h-1 flex-1"
                            max={100}
                            value={Number(progress[index])}
                          >
                            {Number(progress[index])}%
                          </progress>
                        </div>
                      ) : (
                        <p className="text-content-muted">
                          {(file.size / 1_048_576).toFixed(1)} MB
                        </p>
                      )}
                    </div>
                    <button
                      aria-label={`${states[index] === 'uploading' ? 'Cancel upload' : 'Remove'} ${file.name}`}
                      className={
                        states[index] === 'uploading' ? 'text-[#f59e0b]' : ''
                      }
                      disabled={states[index] === 'complete'}
                      onClick={() => {
                        if (states[index] === 'uploading') {
                          controllers.current[index]?.abort();
                          return;
                        }
                        setFiles((current) =>
                          current.filter((_, item) => item !== index),
                        );
                        setStates((current) =>
                          current.filter((_, item) => item !== index),
                        );
                        setProgress((current) =>
                          current.filter((_, item) => item !== index),
                        );
                      }}
                      type="button"
                    >
                      <AppSymbol weight={100}>cancel</AppSymbol>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-6 text-[13px] text-content-muted" role="status">
            PNG, JPG and PDF supported and up to 5mb.{' '}
            {pending || complete ? (
              <span>
                ({states.filter((state) => state === 'complete').length} of{' '}
                {files.length} uploaded)
              </span>
            ) : null}
          </p>
          {error ? (
            <p className="mt-3 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <footer className="flex justify-end gap-4 border-t border-control-border bg-surface-subtle px-6 py-4">
          {complete ? (
            <Button onClick={onComplete} type="button">
              Done
            </Button>
          ) : (
            <>
              <Button
                disabled={pending}
                onClick={onClose}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                disabled={pending || files.length === 0 || Boolean(error)}
                onClick={() => void submit()}
                type="button"
              >
                Upload
              </Button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
