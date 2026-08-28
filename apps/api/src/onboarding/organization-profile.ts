import { createHmac } from 'node:crypto';
import {
  countryOptions,
  industryOptions,
  organizationSizeOptions,
  placeServiceOptions,
  type OrganizationProfilePageResponse,
  type OrganizationProfileRequest,
  type OrganizationProfileResponse,
} from '@hansel/contracts';

export class OrganizationProfileTransitionError extends Error {}
export class OrganizationProfileConflictError extends Error {}

interface OrganizationProfileDependencies {
  prepare(input: {
    credentialDigest: string;
    submissionKeyDigest: string;
    now: Date;
    expiresAt: Date;
  }): Promise<
    | boolean
    | {
        profile: Omit<OrganizationProfileRequest, 'submissionKey'>;
      }
  >;
  save(input: {
    credentialDigest: string;
    submissionKeyDigest: string;
    requestDigest: string;
    nextCredentialDigest: string;
    nextCredentialExpiresAt: Date;
    now: Date;
    profile: Omit<OrganizationProfileRequest, 'submissionKey'>;
  }): Promise<
    'created' | 'replay-initial' | 'replay-current' | 'conflict' | 'rejected'
  >;
  createSubmissionKey(): string;
  digestSubmissionKey(value: string): string;
  digestRequest(value: string): string;
  digestOnboardingCredential(value: string): string;
  deriveOnboardingCredential(credential: string, submissionKey: string): string;
  createOnboardingCsrfProof(value: string): string;
  verifyOnboardingCsrfProof(credential: string, proof: string): boolean;
  now(): Date;
  recordEvent(name: string): void;
}

const canonical = (
  profile: Omit<OrganizationProfileRequest, 'submissionKey'>,
) =>
  JSON.stringify([
    profile.organizationName,
    profile.country,
    profile.industry,
    profile.placeService,
    profile.organizationSize,
  ]);

export function createOrganizationProfile(
  dependencies: OrganizationProfileDependencies,
) {
  return {
    async load(credential: string): Promise<OrganizationProfilePageResponse> {
      const submissionKey = dependencies.createSubmissionKey();
      const now = dependencies.now();
      const prepared = await dependencies.prepare({
        credentialDigest: dependencies.digestOnboardingCredential(credential),
        submissionKeyDigest: dependencies.digestSubmissionKey(submissionKey),
        now,
        expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      });
      if (!prepared) {
        dependencies.recordEvent('organization_profile_transition_rejected');
        throw new OrganizationProfileTransitionError();
      }
      dependencies.recordEvent('organization_profile_page_loaded');
      return {
        submissionKey,
        countries: countryOptions,
        industries: [...industryOptions],
        placesByIndustry: Object.fromEntries(
          Object.entries(placeServiceOptions).map(([industry, options]) => [
            industry,
            [...options],
          ]),
        ),
        sizes: [...organizationSizeOptions],
        ...(prepared === true ? {} : prepared),
      };
    },
    async submit(
      credential: string,
      csrfProof: string,
      input: OrganizationProfileRequest,
    ): Promise<
      OrganizationProfileResponse & {
        onboardingCredential: string;
        csrfProof: string;
      }
    > {
      if (!dependencies.verifyOnboardingCsrfProof(credential, csrfProof)) {
        dependencies.recordEvent('organization_profile_transition_rejected');
        throw new OrganizationProfileTransitionError();
      }
      const { submissionKey, ...profile } = input;
      const nextCredential = dependencies.deriveOnboardingCredential(
        credential,
        submissionKey,
      );
      const now = dependencies.now();
      const result = await dependencies.save({
        credentialDigest: dependencies.digestOnboardingCredential(credential),
        submissionKeyDigest: dependencies.digestSubmissionKey(submissionKey),
        requestDigest: dependencies.digestRequest(canonical(profile)),
        nextCredentialDigest:
          dependencies.digestOnboardingCredential(nextCredential),
        nextCredentialExpiresAt: new Date(now.getTime() + 15 * 60 * 1000),
        now,
        profile,
      });
      if (result === 'conflict') {
        dependencies.recordEvent('organization_profile_conflict');
        throw new OrganizationProfileConflictError();
      }
      if (result === 'rejected') {
        dependencies.recordEvent('organization_profile_transition_rejected');
        throw new OrganizationProfileTransitionError();
      }
      dependencies.recordEvent(
        result.startsWith('replay')
          ? 'organization_profile_idempotent_replay'
          : 'organization_profile_created',
      );
      return {
        nextStep: 'discovery',
        onboardingCredential:
          result === 'replay-current' ? credential : nextCredential,
        csrfProof:
          result === 'replay-current'
            ? csrfProof
            : dependencies.createOnboardingCsrfProof(nextCredential),
      };
    },
  };
}

export function createOrganizationProfileDigests(key: string) {
  const digest = (scope: string, value: string) =>
    createHmac('sha256', key).update(`${scope}:${value}`).digest('hex');
  return {
    digestSubmissionKey: (value: string) => digest('submission', value),
    digestRequest: (value: string) => digest('request', value),
  };
}
