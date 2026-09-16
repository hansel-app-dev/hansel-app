/** @spec microsoft-local-auth REQ-004..REQ-008 */
import { createHmac, randomBytes, randomInt } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { externalPolicyVersion } from './external-login.js';

export function createMicrosoftSignup(deps: {
  prisma: PrismaClient;
  digestKey: string;
  sendVerificationCode(email: string, code: string): Promise<void>;
  now(): Date;
  recordEvent?(category: string): void;
}) {
  const digest = (purpose: string, value: string) =>
    createHmac('sha256', deps.digestKey)
      .update(`${purpose}:${value}`)
      .digest('hex');
  const key = (credential: string) => digest('microsoft-pending', credential);
  const codeDigest = (credential: string, email: string, code: string) =>
    digest('microsoft-code', JSON.stringify([credential, email, code]));
  const active = (credential: string) => ({
    credentialDigest: key(credential),
    expiresAt: { gt: deps.now() },
  });
  return {
    async start(input: {
      subject: string;
      emailHint?: string;
      termsVersion: string;
      privacyVersion: string;
    }) {
      if (
        input.termsVersion !== externalPolicyVersion ||
        input.privacyVersion !== externalPolicyVersion
      )
        throw new Error('Current consent required');
      const credential = randomBytes(32).toString('base64url');
      const now = deps.now();
      await deps.prisma.microsoftPendingSignup.create({
        data: {
          credentialDigest: key(credential),
          subject: input.subject,
          termsVersion: input.termsVersion,
          privacyVersion: input.privacyVersion,
          consentedAt: now,
          expiresAt: new Date(now.getTime() + 30 * 60_000),
          ...(input.emailHint ? { email: input.emailHint } : {}),
        },
      });
      deps.recordEvent?.('microsoft_signup_started');
      return credential;
    },
    async read(credential: string) {
      const pending = await deps.prisma.microsoftPendingSignup.findFirst({
        where: active(credential),
      });
      return pending
        ? {
            email: pending.email ?? '',
            sent: pending.delivered,
            resendAfter: pending.sentAt
              ? Math.max(
                  0,
                  Math.ceil(
                    (pending.sentAt.getTime() + 60_000 - deps.now().getTime()) /
                      1000,
                  ),
                )
              : 0,
          }
        : null;
    },
    async send(
      credential: string,
      rawEmail: string,
    ): Promise<'sent' | 'expired' | 'limited' | 'invalid' | 'unavailable'> {
      const email = rawEmail.trim().toLowerCase();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return 'invalid';
      const now = deps.now();
      const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
      const hashedCode = codeDigest(credential, email, code);
      const reserved = await deps.prisma.$transaction(async (tx) => {
        // Serialize both per-mailbox sends and per-browser challenge replacement.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${digest('microsoft-email', email)}, 0))`;
        await tx.$queryRaw`SELECT "credentialDigest" FROM "MicrosoftPendingSignup" WHERE "credentialDigest" = ${key(credential)} FOR UPDATE`;
        const pending = await tx.microsoftPendingSignup.findFirst({
          where: active(credential),
        });
        if (!pending) return 'expired' as const;
        if (pending.sentAt && now.getTime() - pending.sentAt.getTime() < 60_000)
          return 'limited' as const;
        const sends = await tx.microsoftVerificationSend.count({
          where: {
            emailDigest: digest('microsoft-email', email),
            sentAt: { gt: new Date(now.getTime() - 3_600_000) },
          },
        });
        if (sends >= 5) return 'limited' as const;
        await tx.microsoftVerificationSend.create({
          data: { emailDigest: digest('microsoft-email', email), sentAt: now },
        });
        await tx.microsoftPendingSignup.update({
          where: { credentialDigest: key(credential) },
          data: {
            email,
            codeDigest: hashedCode,
            codeExpiresAt: new Date(now.getTime() + 15 * 60_000),
            sentAt: now,
            delivered: false,
            failedAttempts: 0,
          },
        });
        return 'reserved' as const;
      });
      if (reserved !== 'reserved') {
        deps.recordEvent?.('microsoft_verification_send_rejected');
        return reserved;
      }
      try {
        await deps.sendVerificationCode(email, code);
      } catch {
        deps.recordEvent?.('microsoft_verification_delivery_failed');
        return 'unavailable';
      }
      const delivered = await deps.prisma.microsoftPendingSignup.updateMany({
        where: { ...active(credential), codeDigest: hashedCode },
        data: { delivered: true },
      });
      deps.recordEvent?.(
        delivered.count === 1
          ? 'microsoft_verification_sent'
          : 'microsoft_verification_send_rejected',
      );
      return delivered.count === 1 ? 'sent' : 'expired';
    },
    async verify(credential: string, code: string) {
      const now = deps.now();
      const continuation = randomBytes(32).toString('base64url');
      try {
        const result = await deps.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "credentialDigest" FROM "MicrosoftPendingSignup" WHERE "credentialDigest" = ${key(credential)} FOR UPDATE`;
          const pending = await tx.microsoftPendingSignup.findFirst({
            where: {
              ...active(credential),
              delivered: true,
              email: { not: null },
              codeExpiresAt: { gt: now },
              failedAttempts: { lt: 5 },
            },
          });
          if (!pending) return null;
          // The query requires email; parse also protects against invalid stored data.
          const email = z.email().parse(pending.email);
          if (
            !/^\d{6}$/.test(code) ||
            pending.codeDigest !== codeDigest(credential, email, code)
          ) {
            await tx.microsoftPendingSignup.update({
              where: { credentialDigest: key(credential) },
              data: { failedAttempts: { increment: 1 } },
            });
            return null;
          }
          await tx.user.create({
            data: {
              email,
              emailVerifiedAt: now,
              externalIdentities: {
                create: { provider: 'MICROSOFT', subject: pending.subject },
              },
              consents: {
                create: {
                  termsVersion: pending.termsVersion,
                  privacyVersion: pending.privacyVersion,
                  consentedAt: pending.consentedAt,
                  onboardingPath: 'new-organization',
                  country: 'unknown',
                },
              },
              journeys: {
                create: {
                  entryPath: 'NEW_ORGANIZATION',
                  currentStep: 'PERSONAL_PROFILE',
                },
              },
              continuation: {
                create: {
                  credentialDigest: digest('onboarding', continuation),
                  expiresAt: new Date(now.getTime() + 15 * 60_000),
                },
              },
            },
          });
          await tx.microsoftPendingSignup.delete({
            where: { credentialDigest: key(credential) },
          });
          return {
            destination: '/onboarding/about-you' as const,
            onboardingCredential: continuation,
          };
        });
        deps.recordEvent?.(
          result
            ? 'microsoft_signup_completed'
            : 'microsoft_verification_rejected',
        );
        return result;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          deps.recordEvent?.('microsoft_verification_rejected');
          return null;
        }
        deps.recordEvent?.('microsoft_signup_dependency_failed');
        throw error;
      }
    },
    async cleanup() {
      await deps.prisma.microsoftPendingSignup.deleteMany({
        where: { expiresAt: { lte: deps.now() } },
      });
      await deps.prisma.microsoftVerificationSend.deleteMany({
        where: { sentAt: { lte: new Date(deps.now().getTime() - 3_600_000) } },
      });
    },
  };
}
