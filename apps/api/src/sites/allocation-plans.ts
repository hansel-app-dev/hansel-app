/** @spec site-allocation-plans-add REQ-001..REQ-019 */
import type {
  AllocationPlan,
  AllocationPlansResponse,
  CreateAllocationPlanUploadBatchRequest,
  CreateAllocationPlanUploadBatchResponse,
  FinalizeAllocationPlanUploadResponse,
} from '@hansel/contracts';
import type { ApplicationPrincipal } from './sites.js';
import { hasOrganizationCapability } from './permissions.js';

export interface PendingAllocationPlanUpload {
  id: string;
  tenantId: string;
  siteId: string;
  objectKey: string;
  filename: string;
  mediaType: 'image/png' | 'image/jpeg' | 'application/pdf';
  byteSize: number;
  checksumSha256: string;
  expiresAt: Date;
  status: 'PENDING' | 'COMPLETED' | 'REJECTED' | 'EXPIRED';
  plan?: AllocationPlan;
}

export interface AllocationPlanStore {
  canAccess(principal: ApplicationPrincipal, siteId: string): Promise<boolean>;
  list(
    principal: ApplicationPrincipal,
    siteId: string,
  ): Promise<AllocationPlan[]>;
  findContent(
    principal: ApplicationPrincipal,
    siteId: string,
    planId: string,
  ): Promise<{ objectKey: string; mediaType: string } | null>;
  createBatch(input: {
    principal: ApplicationPrincipal;
    siteId: string;
    request: CreateAllocationPlanUploadBatchRequest;
    requestDigest: string;
    keyDigest: string;
    expiresAt: Date;
    uploads: {
      id: string;
      objectKey: string;
      filename: string;
      mediaType: 'image/png' | 'image/jpeg' | 'application/pdf';
      byteSize: number;
      checksumSha256: string;
    }[];
  }): Promise<
    | { status: 'created'; uploads: PendingAllocationPlanUpload[] }
    | { status: 'replayed'; uploads: PendingAllocationPlanUpload[] }
    | { status: 'conflict' }
    | { status: 'forbidden' }
  >;
  findUpload(
    principal: ApplicationPrincipal,
    siteId: string,
    uploadId: string,
  ): Promise<PendingAllocationPlanUpload | null>;
  complete(
    principal: ApplicationPrincipal,
    upload: PendingAllocationPlanUpload,
    finalObjectKey: string,
  ): Promise<AllocationPlan>;
  reject(uploadId: string, code: string): Promise<void>;
}

export interface AllocationPlanObjectStore {
  signPut(input: {
    objectKey: string;
    mediaType: string;
    byteSize: number;
    checksumSha256: string;
    expiresInSeconds: number;
  }): Promise<string>;
  inspect(objectKey: string): Promise<{
    byteSize: number;
    mediaType: string | undefined;
    checksumSha256: string | undefined;
    leadingBytes: Uint8Array;
  } | null>;
  remove(objectKey: string): Promise<void>;
  promote(sourceKey: string, destinationKey: string): Promise<void>;
  read(objectKey: string): Promise<Uint8Array>;
}

export class AllocationPlansForbiddenError extends Error {}
export class AllocationPlansNotFoundError extends Error {}
export class AllocationPlansConflictError extends Error {}
export class AllocationPlanUploadRejectedError extends Error {}

const canAdd = (roleId: string) =>
  hasOrganizationCapability(roleId, 'CREATE_SITE');

function validSignature(mediaType: string, bytes: Uint8Array): boolean {
  if (mediaType === 'image/png')
    return [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    );
  if (mediaType === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216;
  return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
}

export function createAllocationPlansFeature(dependencies: {
  store: AllocationPlanStore;
  objects: AllocationPlanObjectStore;
  createId(): string;
  digest(value: string): string;
  now(): Date;
}) {
  const authorize = async (
    principal: ApplicationPrincipal,
    siteId: string,
    mutation = false,
  ) => {
    if (mutation && !canAdd(principal.roleId))
      throw new AllocationPlansForbiddenError();
    if (!(await dependencies.store.canAccess(principal, siteId)))
      throw new AllocationPlansNotFoundError();
  };
  return {
    async list(
      principal: ApplicationPrincipal,
      siteId: string,
    ): Promise<AllocationPlansResponse> {
      await authorize(principal, siteId);
      return {
        canAddPlans: canAdd(principal.roleId),
        plans: await dependencies.store.list(principal, siteId),
      };
    },
    async content(
      principal: ApplicationPrincipal,
      siteId: string,
      planId: string,
    ): Promise<{ mediaType: string; bytes: Uint8Array }> {
      await authorize(principal, siteId);
      const plan = await dependencies.store.findContent(
        principal,
        siteId,
        planId,
      );
      if (!plan) throw new AllocationPlansNotFoundError();
      if (
        !['image/png', 'image/jpeg', 'application/pdf'].includes(plan.mediaType)
      )
        throw new AllocationPlanUploadRejectedError();
      const bytes = await dependencies.objects.read(plan.objectKey);
      if (bytes.byteLength < 1 || bytes.byteLength > 5_242_880)
        throw new AllocationPlanUploadRejectedError();
      return { mediaType: plan.mediaType, bytes };
    },
    async createBatch(
      principal: ApplicationPrincipal,
      siteId: string,
      request: CreateAllocationPlanUploadBatchRequest,
    ): Promise<CreateAllocationPlanUploadBatchResponse> {
      await authorize(principal, siteId, true);
      const normalized = {
        ...request,
        files: request.files.map((file) => ({
          ...file,
          filename: file.filename.normalize('NFC'),
        })),
      };
      const duplicate = new Set<string>();
      for (const file of normalized.files) {
        const identity = [
          file.filename,
          String(file.byteSize),
          file.checksumSha256,
        ].join('\0');
        if (duplicate.has(identity))
          throw new AllocationPlanUploadRejectedError();
        duplicate.add(identity);
      }
      const expiresAt = new Date(dependencies.now().getTime() + 15 * 60_000);
      const uploads = normalized.files.map((file) => {
        const id = dependencies.createId();
        return {
          id,
          objectKey: `quarantine/${id}`,
          ...file,
        };
      });
      const result = await dependencies.store.createBatch({
        principal,
        siteId,
        request: normalized,
        requestDigest: dependencies.digest(JSON.stringify(normalized.files)),
        keyDigest: dependencies.digest(normalized.idempotencyKey),
        expiresAt,
        uploads,
      });
      if (result.status === 'conflict')
        throw new AllocationPlansConflictError();
      if (result.status === 'forbidden')
        throw new AllocationPlansForbiddenError();
      return {
        uploads: await Promise.all(
          result.uploads.map(async (upload) => ({
            uploadId: upload.id,
            uploadUrl: await dependencies.objects.signPut({
              objectKey: upload.objectKey,
              mediaType: upload.mediaType,
              byteSize: upload.byteSize,
              checksumSha256: upload.checksumSha256,
              expiresInSeconds: Math.max(
                1,
                Math.floor(
                  (upload.expiresAt.getTime() - dependencies.now().getTime()) /
                    1_000,
                ),
              ),
            }),
            expiresAt: upload.expiresAt.toISOString(),
            headers: {
              'content-type': upload.mediaType,
              'x-amz-checksum-sha256': upload.checksumSha256,
            },
          })),
        ),
      };
    },
    async finalize(
      principal: ApplicationPrincipal,
      siteId: string,
      uploadId: string,
    ): Promise<FinalizeAllocationPlanUploadResponse> {
      await authorize(principal, siteId, true);
      const upload = await dependencies.store.findUpload(
        principal,
        siteId,
        uploadId,
      );
      if (!upload) throw new AllocationPlansNotFoundError();
      if (upload.status === 'COMPLETED' && upload.plan)
        return { plan: upload.plan };
      if (upload.status !== 'PENDING' || upload.expiresAt <= dependencies.now())
        throw new AllocationPlanUploadRejectedError();
      const object = await dependencies.objects.inspect(upload.objectKey);
      if (
        object?.byteSize !== upload.byteSize ||
        object.mediaType !== upload.mediaType ||
        object.checksumSha256 !== upload.checksumSha256 ||
        !validSignature(upload.mediaType, object.leadingBytes)
      ) {
        await dependencies.store.reject(upload.id, 'verification_failed');
        if (object) await dependencies.objects.remove(upload.objectKey);
        throw new AllocationPlanUploadRejectedError();
      }
      const finalObjectKey = `plans/${upload.id}`;
      await dependencies.objects.promote(upload.objectKey, finalObjectKey);
      let plan: AllocationPlan;
      try {
        plan = await dependencies.store.complete(
          principal,
          upload,
          finalObjectKey,
        );
      } catch (error) {
        await dependencies.objects.remove(finalObjectKey);
        throw error;
      }
      await dependencies.objects.remove(upload.objectKey);
      return {
        plan,
      };
    },
  };
}
