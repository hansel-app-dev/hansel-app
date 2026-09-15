/** @spec site-cover-image-display REQ-001, REQ-002, REQ-006, REQ-007 */
import { useEffect, useState } from 'react';

export type CoverImageLoader = (
  siteId: string,
  signal: AbortSignal,
) => Promise<Blob>;

export function SiteCoverImage({
  siteId,
  hasCoverImage,
  loadCoverImage,
}: {
  siteId: string;
  hasCoverImage: boolean;
  loadCoverImage?: CoverImageLoader | undefined;
}) {
  const [image, setImage] = useState<{ siteId: string; url: string } | null>(
    null,
  );
  useEffect(() => {
    setImage(null);
    if (!hasCoverImage || !loadCoverImage) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void loadCoverImage(siteId, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setImage({ siteId, url: objectUrl });
      })
      .catch(() => {
        /* A cover failure must not block the Site card. */
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [siteId, hasCoverImage, loadCoverImage]);
  return (
    <span
      className="block h-[174px] overflow-hidden bg-site-cover"
      aria-hidden="true"
    >
      {hasCoverImage && image?.siteId === siteId ? (
        <img
          src={image.url}
          alt=""
          className="h-full w-full object-cover object-center"
          onError={() => {
            setImage(null);
          }}
        />
      ) : null}
    </span>
  );
}
