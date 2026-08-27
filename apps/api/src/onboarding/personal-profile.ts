import type {
  PersonalProfileRequest,
  PersonalProfileResponse,
} from '@hansel/contracts';

export class PersonalProfileTransitionError extends Error {
  readonly code = 'personal_profile_transition_failed';
}

interface PersonalProfileDependencies {
  save(input: {
    credentialDigest: string;
    now: Date;
    profile: PersonalProfileRequest;
  }): Promise<boolean>;
  digestOnboardingCredential(credential: string): string;
  verifyOnboardingCsrfProof(credential: string, proof: string): boolean;
  now(): Date;
}

export function createPersonalProfile(
  dependencies: PersonalProfileDependencies,
) {
  return async function submitPersonalProfile(
    credential: string,
    csrfProof: string,
    profile: PersonalProfileRequest,
  ): Promise<PersonalProfileResponse> {
    const accepted =
      dependencies.verifyOnboardingCsrfProof(credential, csrfProof) &&
      (await dependencies.save({
        credentialDigest: dependencies.digestOnboardingCredential(credential),
        now: dependencies.now(),
        profile,
      }));
    if (!accepted) throw new PersonalProfileTransitionError();
    return { nextStep: 'plan-selection' };
  };
}
