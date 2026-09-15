/** @spec sign-photos REQ-001..009 */
import { useEffect, useRef, useState } from 'react';
import type { SignPhoto } from '@hansel/contracts';
import type { SignPhotosApi } from './sign-photos-api.js';
import { usePhotoUploads } from './use-photo-uploads.js';
import { PhotoDeleteDialog } from './PhotoDeleteDialog.js';
const button =
  'h-8 rounded border border-[#d4d4d8] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#4096ff] disabled:cursor-not-allowed disabled:opacity-60';
export function SignPhotos({
  api,
  signId,
  canManage,
  onBusyChange,
}: {
  api: SignPhotosApi;
  signId: string;
  canManage: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [photos, setPhotos] = useState<SignPhoto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [grid, setGrid] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [target, setTarget] = useState<SignPhoto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteBusy = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const notify = useRef(onBusyChange);
  notify.current = onBusyChange;
  const { uploads, busy, add, retry } = usePhotoUploads(
    api,
    signId,
    (photo) => {
      setPhotos((previous) => [
        ...previous.filter((row) => row.id !== photo.id),
        photo,
      ]);
    },
  );
  useEffect(() => {
    notify.current(busy || !!target);
  }, [busy, target]);
  async function load(next?: string) {
    setLoading(true);
    setError('');
    try {
      const result = await api.list(signId, next);
      if (!mounted.current) return;
      setPhotos((previous) =>
        [...previous, ...result.photos].filter(
          (photo, i, rows) =>
            rows.findIndex((row) => row.id === photo.id) === i,
        ),
      );
      setCursor(result.nextCursor);
    } catch {
      if (mounted.current) setError('We couldn’t load photos. Please retry.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      notify.current(false);
    };
  }, []);
  async function remove() {
    if (!target || deleteBusy.current || !canManage) return;
    deleteBusy.current = true;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.remove(signId, target.id);
      if (!mounted.current) return;
      setPhotos((previous) =>
        previous.filter((photo) => photo.id !== target.id),
      );
      setTarget(null);
    } catch {
      if (mounted.current)
        setDeleteError('We couldn’t delete this photo. Please retry.');
    } finally {
      deleteBusy.current = false;
      if (mounted.current) setDeleting(false);
    }
  }
  return (
    <div
      role="tabpanel"
      aria-label="Sign photos"
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <div className="pl-[23px] pr-6 pt-[22px] pb-5">
        <p className="text-[13px] leading-[15px] text-[#72727e]">
          <strong>{photos.length ? 'Sign photos' : 'Add sign’s photos'}</strong>
          <br />
          Record conditions of existing signage
        </p>
        {!!photos.length && (
          <>
            <div className="mt-5 mb-4 flex h-6 items-center justify-end gap-2 text-[#a1a1aa]">
              <button
                type="button"
                aria-label="Grid view"
                aria-pressed={grid}
                onClick={() => {
                  setGrid(true);
                }}
                className={`size-6 ${grid ? 'text-[#27272a]' : ''}`}
              >
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                >
                  <rect x="2" y="2" width="5" height="5" rx="1" />
                  <rect x="12" y="2" width="5" height="5" rx="1" />
                  <rect x="2" y="12" width="5" height="5" rx="1" />
                  <rect x="12" y="12" width="5" height="5" rx="1" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="List view"
                aria-pressed={!grid}
                onClick={() => {
                  setGrid(false);
                }}
                className={`size-6 ${!grid ? 'text-[#27272a]' : ''}`}
              >
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                >
                  <path d="M7 4h11M7 10h11M7 16h11" />
                  <circle cx="2" cy="4" r="1" />
                  <circle cx="2" cy="10" r="1" />
                  <circle cx="2" cy="16" r="1" />
                </svg>
              </button>
            </div>
            <div
              aria-label="Photo collection"
              className={grid ? 'grid grid-cols-2 gap-3' : 'space-y-4'}
            >
              {photos.map((photo) => (
                <article
                  key={photo.id}
                  className="group min-w-0 overflow-hidden rounded border border-[#e2e2e7] bg-white hover:shadow-sm focus-within:shadow-sm"
                >
                  <PhotoThumbnail
                    api={api}
                    signId={signId}
                    photo={photo}
                    grid={grid}
                  />
                  <div
                    className={`flex min-w-0 items-center gap-2 px-[15px] text-sm text-[#575757] ${grid ? 'min-h-[60px] flex-wrap py-2' : 'h-[59px]'}`}
                  >
                    <span
                      title={photo.filename}
                      className="min-w-0 flex-1 truncate"
                    >
                      {photo.filename}
                    </span>
                    <div className="flex shrink-0 gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                      <button
                        type="button"
                        aria-label={`Download ${photo.filename}`}
                        className="grid size-6 place-items-center text-[#72727e] focus-visible:outline-2"
                        onClick={() => {
                          void api
                            .download(signId, photo.id, photo.filename)
                            .catch(() => {
                              if (mounted.current)
                                setError(
                                  'Download failed. Click download to retry.',
                                );
                            });
                        }}
                      >
                        <svg
                          aria-hidden="true"
                          width="18"
                          height="18"
                          viewBox="0 0 18 18"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        >
                          <path d="M9 2v10m-4-4 4 4 4-4M3 12v4h12v-4" />
                        </svg>
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={`Delete ${photo.filename}`}
                          className="grid size-6 place-items-center text-[#72727e] focus-visible:outline-2 disabled:opacity-50"
                          onClick={() => {
                            setDeleteError('');
                            setTarget(photo);
                          }}
                        >
                          <svg
                            aria-hidden="true"
                            width="18"
                            height="18"
                            viewBox="0 0 18 18"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.3"
                          >
                            <path d="M3 5h12M7 2h4l1 2H6l1-2ZM4 5l.7 11h8.6L14 5M7 7v7M11 7v7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        {loading && (
          <p role="status" className="mt-3 text-xs text-[#72727e]">
            Loading photos…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-xs text-red-700">
            {error}{' '}
            {error.includes('load photos') && (
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
            className={`${button} mt-4`}
            onClick={() => {
              void load(cursor);
            }}
          >
            Load more
          </button>
        )}
      </div>
      <section
        aria-label="Add photos"
        className="min-h-[calc(100%_-_74px)] border-t border-[#e2e2e7] bg-[#f8f9fb] pl-[23px] pr-6 pt-6 pb-6"
      >
        {!!uploads.length && (
          <div className="mb-4 space-y-2">
            {uploads.map((item) => (
              <div
                key={item.key}
                className="rounded border border-[#d4d4d8] bg-white p-2 text-xs"
                aria-live="polite"
              >
                <p className="truncate" title={item.file.name}>
                  {item.file.name}
                </p>
                {item.state === 'error' ? (
                  <>
                    <p role="alert" className="text-red-700">
                      {item.error}
                    </p>
                    {!item.error?.startsWith('Choose') && (
                      <button
                        type="button"
                        className="underline"
                        onClick={() => {
                          retry(item.key);
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
                      max={100}
                      value={item.progress}
                      aria-label={`Uploading ${item.file.name}`}
                      className="h-1 w-full"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
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
            if (canManage) add(Array.from(event.dataTransfer.files));
          }}
          className={`relative flex h-[232px] flex-col items-center rounded-md border border-transparent px-[23px] pt-[29px] ${dragging ? 'bg-blue-50' : ''}`}
        >
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
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
            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
            aria-label="Upload photos"
            disabled={!canManage}
            className="sr-only"
            onChange={(event) => {
              if (canManage) add(Array.from(event.target.files ?? []));
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
        <p className="mt-3 text-[12px] leading-4 text-[#72727e]">
          PNG and JPG supported and up to 5mb.
        </p>
      </section>
      {target && (
        <PhotoDeleteDialog
          filename={target.filename}
          pending={deleting}
          error={deleteError}
          onCancel={() => {
            if (!deleteBusy.current) setTarget(null);
          }}
          onConfirm={() => {
            void remove();
          }}
        />
      )}
    </div>
  );
}
function PhotoThumbnail({
  api,
  signId,
  photo,
  grid,
}: {
  api: SignPhotosApi;
  signId: string;
  photo: SignPhoto;
  grid: boolean;
}) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setFailed(false);
    void api
      .thumbnail(signId, photo.id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [signId, photo.id, attempt]);
  return (
    <div
      className={`grid place-items-center overflow-hidden bg-[#f1f5f9] ${grid ? 'aspect-square' : 'h-[191px]'}`}
    >
      {failed ? (
        <button
          type="button"
          className="px-2 text-xs underline"
          onClick={() => {
            setAttempt((value) => value + 1);
          }}
        >
          Retry image
        </button>
      ) : url ? (
        <img
          src={url}
          alt={photo.filename}
          onError={() => {
            setFailed(true);
          }}
          className="h-full w-full object-cover"
        />
      ) : (
        <span role="status" className="text-xs text-[#72727e]">
          Loading image…
        </span>
      )}
    </div>
  );
}
