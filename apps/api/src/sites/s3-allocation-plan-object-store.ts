/** @spec site-allocation-plans-add REQ-009..REQ-012, REQ-014, REQ-017 */
import {
  DeleteObjectCommand,
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AllocationPlanObjectStore } from './allocation-plans.js';

export function createS3AllocationPlanObjectStore(input: {
  bucketName: string;
  client?: S3Client;
  sign?: typeof getSignedUrl;
}): AllocationPlanObjectStore {
  const client = input.client ?? new S3Client({});
  const sign = input.sign ?? getSignedUrl;
  return {
    signPut(request) {
      return sign(
        client,
        new PutObjectCommand({
          Bucket: input.bucketName,
          Key: request.objectKey,
          ContentType: request.mediaType,
          ContentLength: request.byteSize,
          ChecksumSHA256: request.checksumSha256,
        }),
        {
          expiresIn: request.expiresInSeconds,
          unhoistableHeaders: new Set(['x-amz-checksum-sha256']),
        },
      );
    },
    async inspect(objectKey) {
      try {
        const head = await client.send(
          new HeadObjectCommand({
            Bucket: input.bucketName,
            Key: objectKey,
            ChecksumMode: 'ENABLED',
          }),
        );
        const object = await client.send(
          new GetObjectCommand({
            Bucket: input.bucketName,
            Key: objectKey,
            Range: 'bytes=0-7',
          }),
        );
        return {
          byteSize: head.ContentLength ?? -1,
          mediaType: head.ContentType,
          checksumSha256: head.ChecksumSHA256,
          leadingBytes: object.Body
            ? await object.Body.transformToByteArray()
            : new Uint8Array(),
        };
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          '$metadata' in error &&
          (error as { $metadata?: { httpStatusCode?: number } }).$metadata
            ?.httpStatusCode === 404
        )
          return null;
        throw error;
      }
    },
    async remove(objectKey) {
      await client.send(
        new DeleteObjectCommand({ Bucket: input.bucketName, Key: objectKey }),
      );
    },
    async promote(sourceKey, destinationKey) {
      await client.send(
        new CopyObjectCommand({
          Bucket: input.bucketName,
          CopySource: `${input.bucketName}/${encodeURIComponent(sourceKey)}`,
          Key: destinationKey,
          MetadataDirective: 'COPY',
        }),
      );
    },
  };
}
