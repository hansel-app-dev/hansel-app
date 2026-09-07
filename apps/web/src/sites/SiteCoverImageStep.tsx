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
  destination: string;
  onComplete: (destination: string) => void;
  siteId: string;
  uploadCoverImage?: (siteId: string, file: File) => Promise<void>;
}

export function SiteCoverImageStep({
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
  const select = async (next?: File) => {
    if (!next) return;
    setError('');
    const validation = await validateImage(next).catch(
      () => "We couldn't read this file. Choose it again.",
    );
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
    if (!file || uploading) return;
    if (!uploadCoverImage) {
      setError("We couldn't add the cover image. Please try again.");
      return;
    }
    setUploading(true);
    setError('');
    void uploadCoverImage(siteId, file)
      .then(() => {
        onComplete(destination);
      })
      .catch(() => {
        setError("We couldn't add the cover image. Please try again.");
      })
      .finally(() => {
        setUploading(false);
      });
  };
  return (
    <>
      <section
        className="px-6 pb-[27px] pt-6"
        aria-labelledby="cover-image-heading"
      >
        <h3 className="sr-only" id="cover-image-heading">
          Cover image upload
        </h3>
        <div
          className={`grid h-[250px] place-items-center rounded-[7px] border border-dashed px-4 text-center ${dragActive ? 'border-action-primary bg-surface-muted' : 'border-[#64748b]'}`}
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
          <div className="grid justify-items-center">
            <svg
              aria-hidden="true"
              className="mb-5 size-[76px] text-[#64748b]"
              fill="none"
              viewBox="0 0 76 76"
            >
              <path
                d="M19 6h27l13 13v49H19V6Z"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="4"
              />
              <path
                d="M46 6v14h13M38 52V31m0 0-10 10m10-10 10 10"
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
              <p className="mb-3 text-[15px]">Drag your file here</p>
            )}
            <div className="mb-4 flex w-32 items-center gap-3 text-sm text-content-muted">
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
              type="button"
              variant="secondary"
              disabled={uploading}
              onClick={() => input.current?.click()}
            >
              Browse files
            </Button>
          </div>
        </div>
        <p className="mt-[26px] text-[13px] text-content-muted">
          PNG, JPG supported and up to 3 MB.
        </p>
        {error ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </section>
      <footer className="flex h-[74px] items-center justify-between gap-4 bg-[#fafbfc] px-6">
        <p className="text-sm text-content-muted">Step 3 of 3</p>
        <div className="flex gap-4">
          <Button
            disabled={uploading}
            onClick={() => {
              onComplete(destination);
            }}
            variant="secondary"
          >
            Skip for now
          </Button>
          <Button
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
