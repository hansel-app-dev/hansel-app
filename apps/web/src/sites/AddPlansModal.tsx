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
  ) => Promise<void>;
  finalize: (uploadId: string) => Promise<void>;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
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
        await upload(intent.uploadUrl, file, intent.headers);
        await finalize(intent.uploadId);
      }
      onComplete();
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
                  className="flex items-center justify-between rounded border border-control-border px-3 py-2"
                  key={[file.name, String(file.size), String(index)].join('-')}
                >
                  <span className="min-w-0 truncate">
                    {file.name} · {(file.size / 1_048_576).toFixed(1)} MB
                  </span>
                  <button
                    aria-label={`Remove ${file.name}`}
                    disabled={pending}
                    onClick={() => {
                      setFiles((current) =>
                        current.filter((_, item) => item !== index),
                      );
                    }}
                    type="button"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-6 text-[13px] text-content-muted">
            PNG, JPG and PDF supported and up to 5mb.
          </p>
          {error ? (
            <p className="mt-3 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          {pending ? (
            <p className="mt-3 text-sm" role="status">
              Uploading plans…
            </p>
          ) : null}
        </div>
        <footer className="flex justify-end gap-4 border-t border-control-border bg-surface-subtle px-6 py-4">
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
        </footer>
      </div>
    </div>
  );
}
