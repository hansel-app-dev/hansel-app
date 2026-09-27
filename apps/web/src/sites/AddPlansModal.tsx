import { LibraryFilePicker } from './LibraryFiles.js';
import type { LibraryFilesApi } from './library-files-api.js';
import type { LibraryFile, LibraryPlan } from '@hansel/contracts';
/** @spec allocation-plan-single-file REQ-001..REQ-009 */
/** @spec allocation-plan-multiple-files REQ-002..REQ-007, REQ-011..REQ-012 */
import { useEffect, useRef, useState } from 'react';
import {
  allocationPlanNameSchema,
  type CommitAllocationPlanDraftRequest,
  type CreateAllocationPlanUploadBatchRequest,
  type CreateAllocationPlanUploadBatchResponse,
} from '@hansel/contracts';
import { AppSymbol } from '../application-shell/ApplicationShell.js';
import { AllocationDraftFilesRejectedError } from './allocation-draft-errors.js';

type Intent = CreateAllocationPlanUploadBatchResponse['uploads'][number];
interface Row {
  id: string;
  file: File;
  state: 'queued' | 'uploading' | 'verifying' | 'verified' | 'failed';
  progress: number;
  intent?: Intent;
  controller?: AbortController;
}
const secondary =
  'h-10 min-w-20 rounded border border-[#d2d3d8] bg-transparent px-[15px] text-[14px] leading-5 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50';
const primary =
  'h-10 min-w-[65px] rounded bg-[#475569] px-4 text-[14px] leading-5 text-white disabled:bg-[#d4d4d8] disabled:text-[#71717a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const types = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'application/pdf': ['.pdf'],
};
async function checksum(file: File) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', await file.arrayBuffer()),
  );
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
}

export function AddPlansModal({
  createBatch,
  upload,
  finalize,
  commit,
  library,
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
    options?: { onProgress(percentage: number): void; signal: AbortSignal },
  ) => Promise<void>;
  finalize: (uploadId: string) => Promise<void>;
  commit?: (input: CommitAllocationPlanDraftRequest) => Promise<void>;
  library?: {
    files: LibraryFilesApi;
    create: (input: LibraryPlan) => Promise<void>;
  };
  onClose: () => void;
  onComplete: () => void;
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySelected, setLibrarySelected] = useState<LibraryFile | null>(
    null,
  );
  const libraryOpenRef = useRef(false);
  libraryOpenRef.current = libraryOpen;
  const libraryAttempt = useRef({ digest: '', key: '' });
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [rows, renderRows] = useState<Row[]>([]);
  const current = useRef<Row[]>([]);
  const [stage, setStage] = useState<'select' | 'upload'>('select');
  const [error, setError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const generation = useRef(0);
  const starting = useRef(false);
  const committing = useRef(false);
  const commitPayload = useRef<CommitAllocationPlanDraftRequest | undefined>(
    undefined,
  );
  const batchKey = useRef(crypto.randomUUID());
  const dialog = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const validName = allocationPlanNameSchema.safeParse(name);
  function update(next: Row[]) {
    current.current = next;
    renderRows(next);
  }
  function patch(value: Partial<Row>) {
    // Only one file is selected; each transfer callback checks its generation.
    update(current.current.map((row) => ({ ...row, ...value })));
  }
  function abandon() {
    generation.current++;
    current.current.forEach((row) => row.controller?.abort());
    onClose();
  }
  function dismiss() {
    if (committing.current) return;
    if (stage === 'upload' || preparing) setConfirm(true);
    else onClose();
  }
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;
  useEffect(() => {
    const invoker = document.activeElement;
    // The dialog is rendered unconditionally before this effect.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const element = dialog.current!;
    dialog.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (libraryOpenRef.current) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissRef.current();
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(
        element.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled):not([type=file]), [tabindex="0"]',
        ),
      ).filter((element) => !element.closest('[inert]'));
      const first = controls[0],
        last = controls.at(-1);
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      generation.current++;
      current.current.forEach((row) => row.controller?.abort());
      window.removeEventListener('keydown', keydown);
      if (invoker instanceof HTMLElement) invoker.focus();
    };
  }, []);
  useEffect(() => {
    if (confirm)
      dialog.current?.querySelector<HTMLButtonElement>('[data-keep]')?.focus();
  }, [confirm]);
  function select(files: File[]) {
    if (starting.current || stage !== 'select' || librarySelected) return;
    for (const file of files) {
      const extensions = Object.entries(types).find(
        ([type]) => type === file.type,
      )?.[1];
      if (
        !extensions?.some((extension) =>
          file.name.toLowerCase().endsWith(extension),
        )
      ) {
        setError('Choose a PNG, JPG or PDF file.');
        return;
      }
      if (file.size < 1 || file.size > 5_242_880) {
        setError('Each file must be between 1 byte and 5 MB.');
        return;
      }
    }
    if (files.length + current.current.length > 1) {
      setError('Choose exactly one file per allocation.');
      return;
    }
    setError('');
    batchKey.current = crypto.randomUUID();
    update([
      ...current.current,
      ...files.map((file): Row => ({
        id: crypto.randomUUID(),
        file,
        state: 'queued',
        progress: 0,
      })),
    ]);
  }
  function remove(id: string) {
    if (committing.current || commitPayload.current) return;
    setError('');
    current.current.find((row) => row.id === id)?.controller?.abort();
    update(current.current.filter((row) => row.id !== id));
    if (!current.current.length) {
      generation.current++;
      starting.current = false;
      setPreparing(false);
      setStage('select');
      batchKey.current = crypto.randomUUID();
      setError('');
    }
  }
  async function transfer(id: string, run: number) {
    const row = current.current.find((entry) => entry.id === id);
    if (!row?.intent || run !== generation.current) return;
    const controller = new AbortController();
    const alive = () =>
      run === generation.current &&
      !controller.signal.aborted &&
      current.current.some((entry) => entry.id === id);
    patch({ state: 'uploading', progress: 0, controller });
    try {
      if (new Date(row.intent.expiresAt).getTime() <= Date.now())
        throw new Error('expired');
      await upload(row.intent.uploadUrl, row.file, row.intent.headers, {
        signal: controller.signal,
        onProgress: (percentage) => {
          if (alive())
            patch({
              progress: Math.round(Math.min(100, Math.max(0, percentage))),
            });
        },
      });
      if (!alive()) return;
      patch({ state: 'verifying', progress: 100 });
      await finalize(row.intent.uploadId);
      if (alive()) patch({ state: 'verified' });
    } catch {
      if (alive()) patch({ state: 'failed' });
    }
  }
  async function createLibraryPlan() {
    if (
      !library ||
      !librarySelected ||
      !validName.success ||
      committing.current
    )
      return;
    const digest = JSON.stringify([validName.data, librarySelected.id]);
    if (libraryAttempt.current.digest !== digest)
      libraryAttempt.current = { digest, key: crypto.randomUUID() };
    committing.current = true;
    setCreating(true);
    setError('');
    const run = generation.current;
    try {
      await library.create({
        name: validName.data,
        fileId: librarySelected.id,
        idempotencyKey: libraryAttempt.current.key,
      });
      if (run === generation.current) onComplete();
    } catch {
      if (run === generation.current)
        setError('We couldn’t add the allocation. Please retry.');
    } finally {
      committing.current = false;
      if (run === generation.current) setCreating(false);
    }
  }
  async function start() {
    if (starting.current || !validName.success || !current.current.length)
      return;
    starting.current = true;
    setPreparing(true);
    setError('');
    const run = generation.current;
    const selected = [...current.current];
    try {
      const files = await Promise.all(
        selected.map(async ({ file }) => ({
          filename: file.name.normalize('NFC'),
          mediaType: file.type as keyof typeof types,
          byteSize: file.size,
          checksumSha256: await checksum(file),
        })),
      );
      if (run !== generation.current) return;
      const result = await createBatch({
        idempotencyKey: batchKey.current,
        files,
      });
      if (run !== generation.current) return;
      if (result.uploads.length !== selected.length)
        throw new Error('manifest');
      update(
        selected.map((row, index) => {
          const intent = result.uploads[index];
          if (!intent) throw new Error('manifest');
          return { ...row, intent };
        }),
      );
      setStage('upload');
      setPreparing(false);
      const queue = selected.map((row) => row.id);
      await Promise.all(
        Array.from({ length: Math.min(3, queue.length) }, async () => {
          let id;
          while ((id = queue.shift())) await transfer(id, run);
        }),
      );
    } catch (failure) {
      if (run === generation.current) {
        if (failure instanceof AllocationDraftFilesRejectedError)
          batchKey.current = crypto.randomUUID();
        setError('We couldn’t start the upload. Please try again.');
      }
    } finally {
      if (run === generation.current) {
        starting.current = false;
        setPreparing(false);
      }
    }
  }
  const active = rows.filter(
    (row) => row.state === 'uploading' || row.state === 'verifying',
  ).length;
  const ready =
    rows.length > 0 && rows.every((row) => row.state === 'verified');
  async function create() {
    if (!commit || committing.current || !ready || !validName.success) return;
    committing.current = true;
    setCreating(true);
    setError('');
    commitPayload.current ??= {
      name: validName.data,
      idempotencyKey: crypto.randomUUID(),
      uploadIds: rows
        .map((row) => row.intent?.uploadId)
        .filter((id): id is string => id !== undefined),
    };
    try {
      await commit(commitPayload.current);
      onComplete();
    } catch (failure) {
      if (failure instanceof AllocationDraftFilesRejectedError) {
        commitPayload.current = undefined;
        generation.current++;
        batchKey.current = crypto.randomUUID();
        update(
          current.current.map(({ file }): Row => ({
            id: crypto.randomUUID(),
            file,
            state: 'queued',
            progress: 0,
          })),
        );
        setStage('select');
        setError(
          'The uploaded files expired or were rejected. Press Next to upload them again.',
        );
      } else {
        setError(
          'We couldn’t add the allocation. Please try again. Your uploaded files are retained temporarily.',
        );
      }
    } finally {
      committing.current = false;
      setCreating(false);
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#18181b]/30 p-4 backdrop-blur-[5px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        ref={dialog}
        inert={libraryOpen ? true : undefined}
        aria-hidden={libraryOpen || undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-plans-title"
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-32px)] w-full max-w-[500px] flex-col overflow-hidden rounded-[6px] bg-white tracking-[0.3px] text-[#27272a] shadow-[0_20px_30px_-10px_#00000030] outline-none"
      >
        <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#d4d4d8] px-6">
          <h2
            id="add-plans-title"
            className="text-[17px] font-semibold leading-6"
          >
            Add new Allocation
          </h2>
          <button
            aria-label="Close Add Allocation"
            type="button"
            onClick={dismiss}
            disabled={creating || confirm}
            className="grid size-6 place-items-center text-[#71717a] focus-visible:outline-2 focus-visible:outline-focus"
          >
            <AppSymbol className="!size-6 text-[24px]" weight={100}>
              close
            </AppSymbol>
          </button>
        </header>
        {confirm ? (
          <div
            className="p-6"
            role="group"
            aria-label="Discard unfinished allocation"
          >
            <p className="text-sm">
              Discard this allocation? Uploaded and unfinished files will be
              abandoned.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-4">
              <button
                data-keep
                type="button"
                className={secondary}
                onClick={() => {
                  setConfirm(false);
                  dialog.current?.focus();
                }}
              >
                Keep editing
              </button>
              <button type="button" className={primary} onClick={abandon}>
                Discard allocation
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 overflow-y-auto px-6 pb-[23px] pt-6">
              <div className="flex h-10 items-center gap-2">
                <span className="grid size-10 shrink-0 place-items-center rounded bg-[#f4f4f5]">
                  <span className="grid size-5 place-items-center rounded-[2px] bg-[#4393ff] text-white">
                    <AppSymbol className="!size-4 text-[15px]" weight={100}>
                      layers
                    </AppSymbol>
                  </span>
                </span>
                <input
                  aria-label="Allocation name"
                  placeholder="New allocation plan"
                  aria-invalid={nameEdited && !validName.success}
                  aria-describedby={
                    nameEdited && !validName.success
                      ? 'allocation-name-error'
                      : undefined
                  }
                  value={name}
                  disabled={creating || Boolean(commitPayload.current)}
                  onChange={(event) => {
                    setNameEdited(true);
                    setName(event.target.value);
                  }}
                  className="h-10 min-w-0 flex-1 rounded border border-[#e0e0e5] bg-white px-[15px] text-[14px] leading-5 outline-none focus:border-focus"
                />
              </div>
              {nameEdited && !validName.success ? (
                <p
                  id="allocation-name-error"
                  className="mt-2 text-xs text-danger"
                >
                  Enter a name of 1–200 characters without control characters.
                </p>
              ) : null}
              {library && stage === 'select' && (
                <div className="my-4 grid gap-3">
                  <button
                    type="button"
                    className={secondary}
                    disabled={preparing || creating || rows.length > 0}
                    onClick={() => {
                      setLibraryOpen(true);
                    }}
                  >
                    Library files
                  </button>
                  {librarySelected && (
                    <div className="flex min-w-0 items-center justify-between gap-2 rounded border border-control-border p-3">
                      <span
                        className="truncate"
                        title={librarySelected.filename}
                      >
                        {librarySelected.filename}
                      </span>
                      <button
                        type="button"
                        className={secondary}
                        disabled={creating}
                        onClick={() => {
                          setLibrarySelected(null);
                        }}
                      >
                        Remove selected file
                      </button>
                    </div>
                  )}
                </div>
              )}
              <input
                ref={picker}
                aria-label="Choose allocation files"
                type="file"
                accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                className="sr-only"
                tabIndex={-1}
                disabled={preparing || stage !== 'select' || !!librarySelected}
                onChange={(event) => {
                  select(Array.from(event.target.files ?? []));
                  event.target.value = '';
                }}
              />
              {librarySelected ? null : stage === 'select' &&
                rows.length === 0 ? (
                <>
                  <div
                    className="relative mt-6 flex h-[250px] flex-col items-center rounded-[6px] text-center"
                    onDragOver={(event) => {
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      select(Array.from(event.dataTransfer.files));
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 size-full"
                      viewBox="0 0 452 250"
                      preserveAspectRatio="none"
                    >
                      <rect
                        x="0.5"
                        y="0.5"
                        width="451"
                        height="249"
                        rx="6"
                        fill="none"
                        stroke="#64748b"
                        strokeDasharray="10 10"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                    <svg
                      aria-hidden="true"
                      className="mt-[38px] size-[76px] shrink-0 text-[#64748b]"
                      viewBox="0 0 76 76"
                      fill="none"
                    >
                      <path
                        d="M15 4h32l18 18v49a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M47 4v18h18M26 52l12-12 12 12M38 40v24"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                    </svg>
                    <p className="mt-[21px] text-[14px] leading-5">
                      Drag your file here to get started
                    </p>
                    <div className="my-2 flex w-[246px] max-w-[85%] items-center gap-[10px] text-[14px] leading-5">
                      <span className="h-px flex-1 bg-[#dce1e9]" />
                      or
                      <span className="h-px flex-1 bg-[#dce1e9]" />
                    </div>
                    <button
                      disabled={preparing || Boolean(librarySelected)}
                      onClick={() => picker.current?.click()}
                      className="h-8 w-[108px] rounded border border-[#d2d3d8] px-[11px] text-[14px] leading-5 focus-visible:outline-2 focus-visible:outline-focus"
                      type="button"
                    >
                      Browse files
                    </button>
                  </div>
                  <p className="mt-6 text-[12px] leading-5 text-[#71717a]">
                    PNG, JPG and PDF supported and up to 5mb.
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-6 mt-6 text-[14px] leading-5">
                    Allocation file
                  </p>
                  <ul aria-label="Allocation files" className="space-y-3">
                    {rows.map((row) => (
                      <li
                        key={row.id}
                        className={`flex min-h-[62px] items-center gap-[10px] rounded-[6px] border px-3 py-[10px] ${row.state === 'verified' ? 'border-[#6aff91] bg-[#f0fdf5]' : 'border-[#d4d4d8] bg-[#fafafa]'}`}
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded bg-[#f4f4f5] text-[#273244]">
                          <AppSymbol
                            className="!size-7 text-[28px]"
                            weight={200}
                          >
                            {row.file.type === 'application/pdf'
                              ? 'picture_as_pdf'
                              : 'image'}
                          </AppSymbol>
                        </span>
                        <div className="min-w-0 flex-1 text-[12px] leading-[18px]">
                          <p
                            className="truncate font-bold"
                            title={row.file.name}
                          >
                            {row.file.name}
                            {row.state === 'uploading'
                              ? ' • Uploading…'
                              : row.state === 'verifying'
                                ? ' • Verifying…'
                                : row.state === 'failed'
                                  ? ' • Upload failed'
                                  : ''}
                          </p>
                          {row.state === 'uploading' ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[#52525b]">
                                {row.progress}%
                              </span>
                              <div
                                role="progressbar"
                                aria-label={`Uploading ${row.file.name}`}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={row.progress}
                                className="h-[6px] flex-1 overflow-hidden rounded-full bg-[#e2e8f0]"
                              >
                                <div
                                  className="h-full rounded-full bg-[#64748b]"
                                  style={{ width: `${String(row.progress)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <p className="text-[#52525b]">
                              {(row.file.size / 1_048_576).toFixed(1)}MB
                              {row.state === 'verified' ? (
                                <span className="sr-only"> — Uploaded</span>
                              ) : null}
                            </p>
                          )}
                          {row.state === 'failed' ? (
                            <button
                              type="button"
                              disabled={active >= 3}
                              className="underline"
                              aria-label={`Retry ${row.file.name}`}
                              onClick={() =>
                                void transfer(row.id, generation.current)
                              }
                            >
                              Retry
                            </button>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          disabled={
                            preparing ||
                            creating ||
                            Boolean(commitPayload.current)
                          }
                          aria-label={`${row.state === 'uploading' ? 'Cancel upload' : 'Remove'} ${row.file.name}`}
                          onClick={() => {
                            remove(row.id);
                          }}
                          className={`grid size-5 shrink-0 place-items-center ${row.state === 'uploading' ? 'text-[#ff7900]' : 'text-[#71717a]'}`}
                        >
                          <AppSymbol
                            className="!size-5 text-[20px]"
                            weight={100}
                          >
                            cancel
                          </AppSymbol>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p role="status" className="sr-only">
                    {rows.filter((row) => row.state === 'verified').length} of{' '}
                    {rows.length} uploaded
                  </p>
                </>
              )}
              {error ? (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {error}
                </p>
              ) : null}
            </div>
            <footer className="flex min-h-[74px] shrink-0 items-center justify-end gap-4 bg-[#f8fafc] px-6 py-4">
              <button
                type="button"
                className={secondary}
                disabled={creating}
                onClick={dismiss}
              >
                Cancel
              </button>
              {stage === 'select' ? (
                <button
                  className={primary}
                  type="button"
                  disabled={
                    preparing ||
                    creating ||
                    (!rows.length && !librarySelected) ||
                    !validName.success
                  }
                  onClick={() => {
                    if (librarySelected) void createLibraryPlan();
                    else void start();
                  }}
                >
                  {creating
                    ? 'Adding…'
                    : preparing
                      ? 'Preparing…'
                      : librarySelected
                        ? 'Add Allocation'
                        : 'Next'}
                </button>
              ) : (
                <button
                  className={`${primary} min-w-[132px]`}
                  type="button"
                  disabled={!ready || !validName.success || creating || !commit}
                  onClick={() => void create()}
                >
                  {creating ? 'Adding…' : 'Add Allocation'}
                </button>
              )}
            </footer>
          </>
        )}
      </div>
      {libraryOpen && library && (
        <LibraryFilePicker
          confirmLabel="Select plan file"
          api={library.files}
          kind="all"
          multiple={false}
          onClose={() => {
            setLibraryOpen(false);
          }}
          onSelect={(files) => {
            // Single selection is required before the picker enables confirmation.
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const file = files[0]!;
            setLibrarySelected(file);
            if (!nameEdited) setName(file.filename.replace(/\.[^.]+$/, ''));
            return Promise.resolve();
          }}
        />
      )}
    </div>
  );
}
