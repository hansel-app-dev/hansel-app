import type {
  PersonalProfilePageResponse,
  PersonalProfileRequest,
  PersonalProfileResponse,
} from '@hansel/contracts';

export class PersonalProfileTransitionError extends Error {
  readonly code = 'personal_profile_transition_failed';
}

interface PersonalProfileDependencies {
  save(input: {
    credentialDigest: string;
    nextCredentialDigest: string;
    nextCredentialExpiresAt: Date;
    now: Date;
    profile: PersonalProfileRequest;
  }): Promise<boolean>;
  digestOnboardingCredential(credential: string): string;
  createOnboardingCredential(): string;
  createOnboardingCsrfProof(credential: string): string;
  verifyOnboardingCsrfProof(credential: string, proof: string): boolean;
  now(): Date;
}

interface PersonalProfileLoaderDependencies {
  load(input: {
    credentialDigest: string;
    now: Date;
  }): Promise<PersonalProfilePageResponse | null>;
  digestOnboardingCredential(credential: string): string;
  now(): Date;
}

export function createPersonalProfileLoader(
  dependencies: PersonalProfileLoaderDependencies,
) {
  return async function loadPersonalProfile(
    credential: string,
  ): Promise<PersonalProfilePageResponse> {
    const result = await dependencies.load({
      credentialDigest: dependencies.digestOnboardingCredential(credential),
      now: dependencies.now(),
    });
    if (!result) throw new PersonalProfileTransitionError();
    return result;
  };
}

export function createPersonalProfile(
  dependencies: PersonalProfileDependencies,
) {
  return async function submitPersonalProfile(
    credential: string,
    csrfProof: string,
    profile: PersonalProfileRequest,
  ): Promise<
    PersonalProfileResponse & {
      onboardingCredential: string;
      csrfProof: string;
    }
  > {
    const nextCredential = dependencies.createOnboardingCredential();
    const now = dependencies.now();
    const accepted =
      dependencies.verifyOnboardingCsrfProof(credential, csrfProof) &&
      (await dependencies.save({
        credentialDigest: dependencies.digestOnboardingCredential(credential),
        nextCredentialDigest:
          dependencies.digestOnboardingCredential(nextCredential),
        nextCredentialExpiresAt: new Date(now.getTime() + 15 * 60 * 1000),
        now,
        profile,
      }));
    if (!accepted) throw new PersonalProfileTransitionError();
    return {
      nextStep: 'plan-selection',
      onboardingCredential: nextCredential,
      csrfProof: dependencies.createOnboardingCsrfProof(nextCredential),
    };
  };
}
