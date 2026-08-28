/** @spec onboarding-discovery REQ-005..REQ-010, REQ-018 @figma 37:649 */
import { createHmac } from 'node:crypto';
import {
  discoveryManagementOptions,
  type DiscoveryPageResponse,
  type DiscoveryRequest,
  type DiscoveryResponse,
} from '@hansel/contracts';

export class DiscoveryTransitionError extends Error {}
export class DiscoveryConflictError extends Error {}

export interface DiscoveryAnswers {
  outcome: 'submitted' | 'skipped';
  currentManagement: 'pdf' | 'spreadsheet' | 'other' | null;
  currentManagementOther: string | null;
  challenges: string | null;
}

interface DiscoveryDependencies {
  prepare(input: {
    credentialDigest: string;
    submissionKeyDigest: string;
    now: Date;
    expiresAt: Date;
  }): Promise<boolean>;
  complete(input: {
    credentialDigest: string;
    submissionKeyDigest: string;
    requestDigest: string;
    now: Date;
    answers: DiscoveryAnswers;
  }): Promise<'created' | 'replay' | 'conflict' | 'rejected'>;
  createSubmissionKey(): string;
  digestSubmissionKey(value: string): string;
  digestRequest(value: string): string;
  digestOnboardingCredential(value: string): string;
  verifyOnboardingCsrfProof(credential: string, proof: string): boolean;
  now(): Date;
  recordEvent(name: string): void;
}

function answersFrom(input: DiscoveryRequest): DiscoveryAnswers {
  if (input.action === 'skip')
    return {
      outcome: 'skipped',
      currentManagement: null,
      currentManagementOther: null,
      challenges: null,
    };
  return {
    outcome: 'submitted',
    currentManagement: input.currentManagement,
    currentManagementOther: input.currentManagementOther ?? null,
    challenges:
      'challenges' in input && typeof input.challenges === 'string'
        ? input.challenges
        : null,
  };
}

const canonical = (answers: DiscoveryAnswers) =>
  JSON.stringify([
    answers.outcome,
    answers.currentManagement,
    answers.currentManagementOther,
    answers.challenges,
  ]);

export function createDiscovery(dependencies: DiscoveryDependencies) {
  return {
    async load(credential: string): Promise<DiscoveryPageResponse> {
      const submissionKey = dependencies.createSubmissionKey();
      const now = dependencies.now();
      const prepared = await dependencies.prepare({
        credentialDigest: dependencies.digestOnboardingCredential(credential),
        submissionKeyDigest: dependencies.digestSubmissionKey(submissionKey),
        now,
        expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      });
      if (!prepared) {
        dependencies.recordEvent('discovery_transition_rejected');
        throw new DiscoveryTransitionError();
      }
      dependencies.recordEvent('discovery_page_loaded');
      return { submissionKey, methods: [...discoveryManagementOptions] };
    },
    async complete(
      credential: string,
      csrfProof: string,
      input: DiscoveryRequest,
    ): Promise<DiscoveryResponse> {
      if (!dependencies.verifyOnboardingCsrfProof(credential, csrfProof)) {
        dependencies.recordEvent('discovery_transition_rejected');
        throw new DiscoveryTransitionError();
      }
      const answers = answersFrom(input);
      const result = await dependencies.complete({
        credentialDigest: dependencies.digestOnboardingCredential(credential),
        submissionKeyDigest: dependencies.digestSubmissionKey(
          input.submissionKey,
        ),
        requestDigest: dependencies.digestRequest(canonical(answers)),
        now: dependencies.now(),
        answers,
      });
      if (result === 'conflict') {
        dependencies.recordEvent('discovery_conflict');
        throw new DiscoveryConflictError();
      }
      if (result === 'rejected') {
        dependencies.recordEvent('discovery_transition_rejected');
        throw new DiscoveryTransitionError();
      }
      dependencies.recordEvent(
        result === 'replay'
          ? 'discovery_idempotent_replay'
          : answers.outcome === 'skipped'
            ? 'discovery_skipped_completion'
            : 'discovery_submitted_completion',
      );
      return { nextStep: 'dashboard', destination: '/dashboard' };
    },
  };
}

export function createDiscoveryDigests(key: string) {
  const digest = (scope: string, value: string) =>
    createHmac('sha256', key).update(`${scope}:${value}`).digest('hex');
  return {
    digestSubmissionKey: (value: string) =>
      digest('discovery-submission', value),
    digestRequest: (value: string) => digest('discovery-request', value),
  };
}
