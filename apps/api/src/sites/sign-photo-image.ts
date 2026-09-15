/** @spec sign-photos REQ-010 */
import sharp from 'sharp';
export async function createSignPhotoThumbnail(
  bytes: Uint8Array,
  mediaType: string,
) {
  if (
    !bytes.length ||
    bytes.length > 5_242_880 ||
    !['image/png', 'image/jpeg'].includes(mediaType)
  )
    throw new Error('invalid_image');
  const source = Buffer.from(bytes);
  const ending =
    mediaType === 'image/png'
      ? Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130])
      : Buffer.from([255, 217]);
  if (!source.subarray(-ending.length).equals(ending))
    throw new Error('invalid_image');
  const image = sharp(source, {
    failOn: 'warning',
    limitInputPixels: 40_000_000,
  }).timeout({ seconds: 10 });
  const metadata = await image.metadata();
  if (
    metadata.format !== (mediaType === 'image/png' ? 'png' : 'jpeg') ||
    (metadata.pages ?? 1) !== 1
  )
    throw new Error('invalid_image');
  return image
    .rotate()
    .resize({
      width: 640,
      height: 640,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
}
