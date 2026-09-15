/** @spec site-cover-image-add REQ-002..REQ-007, REQ-015, REQ-016 */
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Button } from '../design-system/index.js';

const maximumBytes = 3_000_000;

function readLeadingBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
        return;
      }
      reject(new Error('file_read_failed'));
    });
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('file_read_failed'));
    });
    reader.readAsArrayBuffer(file.slice(0, 12));
  });
}

async function validateImage(file: File): Promise<string> {
  if (file.size < 1) return 'Choose a PNG or JPG file that is not empty.';
  if (file.size > maximumBytes) return 'Choose a file that is 3 MB or smaller.';
  if (!['image/png', 'image/jpeg'].includes(file.type))
    return 'Choose a PNG or JPG file.';
  if (
    file.type === 'image/png'
      ? !/\.png$/i.test(file.name)
      : !/\.jpe?g$/i.test(file.name)
  )
    return 'Choose a PNG or JPG file with a matching filename extension.';
  const bytes = await readLeadingBytes(file);
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
    (value, index) => bytes[index] === value,
  );
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (
    (file.type === 'image/png' && !png) ||
    (file.type === 'image/jpeg' && !jpeg)
  )
    return 'This file does not contain a valid PNG or JPG image.';
  return '';
}

export interface SiteCoverImageStepProps {
  totalSteps?: 2 | 3;
  onUploadingChange?: (uploading: boolean) => void;
  destination: string;
  onComplete: (destination: string) => void;
  siteId: string;
  uploadCoverImage?: (siteId: string, file: File) => Promise<void>;
}

export function SiteCoverImageStep({
  totalSteps = 3,
  onUploadingChange,
  destination,
  onComplete,
  siteId,
  uploadCoverImage,
}: SiteCoverImageStepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const uploadInFlight = useRef(false);
  const selectionVersion = useRef(0);
  const select = async (next?: File) => {
    if (!next || uploadInFlight.current) return;
    const version = ++selectionVersion.current;
    setFile(null);
    setError('');
    const validation = await validateImage(next).catch(
      () => "We couldn't read this file. Choose it again.",
    );
    if (version !== selectionVersion.current) return;
    if (validation) {
      setFile(null);
      setError(validation);
      return;
    }
    setFile(next);
  };
  const changed = (event: ChangeEvent<HTMLInputElement>) => {
    void select(event.target.files?.[0]);
  };
  const dropped = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    void select(event.dataTransfer.files[0]);
  };
  const upload = () => {
    if (!file || uploadInFlight.current) return;
    if (!uploadCoverImage) {
      setError("We couldn't add the cover image. Please try again.");
      return;
    }
    setUploading(true);
    uploadInFlight.current = true;
    onUploadingChange?.(true);
    setError('');
    void Promise.resolve()
      .then(() => uploadCoverImage(siteId, file))
      .then(() => {
        onComplete(destination);
      })
      .catch(() => {
        setError("We couldn't add the cover image. Please try again.");
      })
      .finally(() => {
        uploadInFlight.current = false;
        onUploadingChange?.(false);
        setUploading(false);
      });
  };
  return (
    <>
      <section className="px-6 pb-6 pt-6" aria-labelledby="cover-image-heading">
        <h3 className="sr-only" id="cover-image-heading">
          Cover image upload
        </h3>
        <div
          className={`relative grid h-[250px] place-items-center rounded-[6px] px-4 text-center ${dragActive ? 'bg-[#edf2f8]' : 'bg-[#f8f9fb]'}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => {
            setDragActive(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={dropped}
        >
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full text-[#64748b]"
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
              stroke="currentColor"
              strokeDasharray="12 8"
            />
          </svg>
          <div className="grid justify-items-center pt-3">
            <svg
              aria-hidden="true"
              className="mb-5 size-[76px] text-[#64748b]"
              fill="none"
              viewBox="0 0 76 76"
            >
              <path
                d="M16 2h32l17 17v50a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V7a5 5 0 0 1 5-5Z"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="4"
              />
              <path
                d="M48 2v17h17M38 59V38m0 0-11 11m11-11 11 11"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="4"
              />
            </svg>
            {file ? (
              <div role="status" className="mb-3 min-w-0">
                <p className="max-w-[300px] truncate text-[15px] font-medium">
                  {file.name}
                </p>
                <p className="text-[13px] text-content-muted">
                  {(file.size / 1_000_000).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <p className="mb-2 text-sm leading-5">Drag your file here</p>
            )}
            <div className="mb-2 flex h-5 w-32 items-center gap-3 text-sm">
              <span className="h-px flex-1 bg-[#e3e5e8]" />
              <span>or</span>
              <span className="h-px flex-1 bg-[#e3e5e8]" />
            </div>
            <input
              aria-label="Choose cover image"
              ref={input}
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              className="sr-only"
              disabled={uploading}
              onChange={changed}
              type="file"
            />
            <Button
              className="!min-h-8 h-8 w-[108px] !px-0 !py-0 !font-normal shadow-none bg-transparent"
              type="button"
              variant="secondary"
              disabled={uploading}
              onClick={() => input.current?.click()}
            >
              Browse files
            </Button>
          </div>
        </div>
        <p className="mt-6 text-xs leading-5 text-content-muted">
          PNG, JPG supported and up to 3mb.
        </p>
        {error ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </section>
      <footer className="flex min-h-[72px] flex-wrap items-center justify-between gap-4 bg-[#f8f9fb] px-6 py-4">
        <p className="text-sm text-content-muted">
          Step {totalSteps} of {totalSteps}
        </p>
        <div className="flex flex-wrap gap-4 [&>button]:!font-normal [&>button]:shadow-none">
          <Button
            className="w-[118px] !px-0 bg-transparent"
            disabled={uploading}
            onClick={() => {
              onComplete(destination);
            }}
            variant="secondary"
          >
            Skip for now
          </Button>
          <Button
            className="min-w-[148px] !px-4 disabled:!bg-[#d4d4d8] disabled:!border-[#d4d4d8] disabled:!text-[#72727e] disabled:!opacity-100"
            disabled={!file || uploading}
            onClick={upload}
          >
            {uploading ? 'Adding cover image…' : 'Add cover image'}
          </Button>
        </div>
      </footer>
    </>
  );
}
