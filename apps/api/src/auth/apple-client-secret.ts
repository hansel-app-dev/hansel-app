/** @spec user-login REQ-015 */
import { importPKCS8, SignJWT } from 'jose';

export async function createAppleClientSecret(input: {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
  now: Date;
}): Promise<string> {
  const issuedAt = Math.floor(input.now.getTime() / 1_000);
  const signingKey = await importPKCS8(input.privateKey, 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: input.keyId })
    .setIssuer(input.teamId)
    .setSubject(input.clientId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 180 * 24 * 60 * 60)
    .sign(signingKey);
}
