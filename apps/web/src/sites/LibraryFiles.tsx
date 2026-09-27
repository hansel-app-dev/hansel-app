import { createPortal } from 'react-dom';
/** @spec library-files REQ-004,005,011,013 */
import { useEffect, useRef, useState } from 'react';
import type { LibraryFile, LibraryQuery } from '@hansel/contracts';
import { Modal, Button } from '../design-system/index.js';
import {
  ApplicationShell,
  type ApplicationShellProps,
} from '../application-shell/ApplicationShell.js';
import type { LibraryFilesApi } from './library-files-api.js';
export function LibraryFileList({
  api,
  kind: initialKind = 'all',
  selected,
  onToggle,
  multiple = true,
  disabled = false,
}: {
  api: LibraryFilesApi;
  kind?: LibraryQuery['kind'];
  selected?: ReadonlySet<string>;
  multiple?: boolean;
  onToggle?: (file: LibraryFile) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(''),
    [kind, setKind] = useState(initialKind),
    [files, setFiles] = useState<LibraryFile[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const generation = useRef(0),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    const version = ++generation.current;
    setLoading(true);
    setError('');
    setFiles([]);
    setCursor(null);
    api
      .list({ q: query, kind })
      .then((result) => {
        if (active.current && version === generation.current) {
          setFiles(result.files);
          setCursor(result.nextCursor);
        }
      })
      .catch(() => {
        if (active.current && version === generation.current)
          setError('We couldn’t load Library Files. Please retry.');
      })
      .finally(() => {
        if (active.current && version === generation.current) setLoading(false);
      });
  }, [api, query, kind, attempt]);
  async function older(cursor: string) {
    const version = generation.current;
    setLoading(true);
    setError('');
    try {
      const result = await api.list({ q: query, kind, cursor });
      if (active.current && version === generation.current) {
        setFiles((current) => [
          ...current,
          ...result.files.filter(
            (file) => !current.some((old) => old.id === file.id),
          ),
        ]);
        setCursor(result.nextCursor);
      }
    } catch {
      if (active.current && version === generation.current)
        setError('We couldn’t load more files. Please retry.');
    } finally {
      if (active.current && version === generation.current) setLoading(false);
    }
  }
  async function download(file: LibraryFile) {
    try {
      await api.download(file.id, file.filename);
    } catch {
      if (active.current)
        setError('We couldn’t download this file. Please retry.');
    }
  }
  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap gap-3">
        <label className="grid flex-1 gap-1 text-sm">
          Search files
          <input
            type="search"
            maxLength={200}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            className="min-w-0 rounded border border-control-border px-3 py-2 focus-visible:outline-focus"
            disabled={disabled}
          />
        </label>
        {initialKind !== 'image' && (
          <label className="grid gap-1 text-sm">
            File type
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as LibraryQuery['kind']);
              }}
              className="rounded border border-control-border px-3 py-2"
              disabled={disabled}
            >
              <option value="all">All files</option>
              <option value="image">Images</option>
              <option value="pdf">PDF</option>
            </select>
          </label>
        )}
      </div>
      {error && (
        <div role="alert">
          {error}
          <Button
            variant="secondary"
            onClick={() => {
              setAttempt((v) => v + 1);
            }}
            disabled={disabled}
          >
            Retry
          </Button>
        </div>
      )}
      {loading && <p role="status">Loading files…</p>}
      {!loading && !error && !files.length && <p>No files found.</p>}
      <ul
        className="grid max-h-[50vh] gap-2 overflow-y-auto"
        aria-label="Library Files"
      >
        {files.map((file) => (
          <li
            key={file.id}
            className="min-w-0 rounded border border-control-border bg-white p-3"
          >
            {onToggle ? (
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type={multiple ? 'checkbox' : 'radio'}
                  name="library-selection"
                  checked={selected?.has(file.id) ?? false}
                  onChange={() => {
                    onToggle(file);
                  }}
                  disabled={disabled}
                  aria-label={file.filename}
                />
                <FileMetadata file={file} />
              </label>
            ) : (
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <FileMetadata file={file} />
                <Button variant="secondary" onClick={() => void download(file)}>
                  Download
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {cursor && (
        <Button
          variant="secondary"
          disabled={loading || disabled}
          onClick={() => void older(cursor)}
        >
          Load more
        </Button>
      )}
    </div>
  );
}
function FileMetadata({ file }: { file: LibraryFile }) {
  return (
    <div className="min-w-0 text-sm">
      <p className="truncate font-medium" title={file.filename}>
        {file.filename}
      </p>
      <p className="text-content-muted">
        {file.mediaType === 'application/pdf'
          ? 'PDF'
          : file.mediaType === 'image/png'
            ? 'PNG'
            : 'JPEG'}{' '}
        · {String(file.byteSize)} bytes · {file.sourceSite.name}
      </p>
      <p className="text-content-muted">
        {file.uploadedBy} · {new Date(file.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}
export function LibraryFilePicker({
  api,
  kind,
  multiple,
  onSelect,
  onClose,
  confirmLabel = 'Use selected files',
}: {
  api: LibraryFilesApi;
  kind: LibraryQuery['kind'];
  multiple: boolean;
  onSelect: (files: LibraryFile[], key: string) => Promise<void>;
  confirmLabel?: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Map<string, LibraryFile>>(new Map()),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const active = useRef(true),
    busy = useRef(false),
    attempt = useRef({ digest: '', key: '' });
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const ids = new Set(selected.keys());
  async function submit() {
    if (busy.current || !selected.size) return;
    busy.current = true;
    setPending(true);
    setError('');
    const files = [...selected.values()].sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
      digest = JSON.stringify(files.map((f) => f.id).sort());
    if (attempt.current.digest !== digest)
      attempt.current = { digest, key: crypto.randomUUID() };
    try {
      await onSelect(files, attempt.current.key);
      if (active.current) onClose();
    } catch {
      if (active.current)
        setError('We couldn’t use the selected files. Please retry.');
    } finally {
      busy.current = false;
      if (active.current) setPending(false);
    }
  }
  return createPortal(
    <Modal
      title="Library files"
      size="wide"
      onClose={() => {
        if (!busy.current) onClose();
      }}
    >
      <div className="grid gap-5 p-6">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Library files</h2>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Close
          </Button>
        </header>
        <LibraryFileList
          api={api}
          kind={kind}
          selected={ids}
          multiple={multiple}
          disabled={pending}
          onToggle={(file) => {
            setSelected((current) => {
              const next = multiple
                ? new Map(current)
                : new Map<string, LibraryFile>();
              if (current.has(file.id)) next.delete(file.id);
              else next.set(file.id, file);
              return next;
            });
          }}
        />
        {error && <p role="alert">{error}</p>}
        <footer className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending || !selected.size}
            onClick={() => void submit()}
          >
            {pending ? 'Adding…' : confirmLabel}
          </Button>
        </footer>
      </div>
    </Modal>,
    document.body,
  );
}
export function LibraryFilesPage({
  api,
  ...shell
}: { api: LibraryFilesApi } & Pick<
  ApplicationShellProps,
  'loadDashboard' | 'logout' | 'navigate'
>) {
  return (
    <ApplicationShell
      {...shell}
      activePage="Files"
      headerActions={null}
      loadErrorMessage="We couldn’t load your library. Please retry."
      pageHeading="Library Files"
    >
      <section className="min-w-0 p-6" aria-label="Library Files">
        <h1 className="mb-6 text-2xl font-semibold">Library Files</h1>
        <LibraryFileList api={api} />
      </section>
    </ApplicationShell>
  );
}
