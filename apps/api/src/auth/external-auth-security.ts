/** @spec user-login REQ-014, REQ-018 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto';

export function createExternalAuthSecurity(secret: string) {
  const encryptionKey = createHash('sha256').update(secret).digest();
  return {
    createState: () => randomBytes(32).toString('base64url'),
    createNonce: () => randomBytes(32).toString('base64url'),
    createCodeVerifier: () => randomBytes(32).toString('base64url'),
    digest: (value: string) =>
      createHmac('sha256', secret).update(value).digest('base64url'),
    seal(value: { nonce: string; codeVerifier: string }): string {
      const initializationVector = randomBytes(12);
      const cipher = createCipheriv(
        'aes-256-gcm',
        encryptionKey,
        initializationVector,
      );
      const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify(value), 'utf8'),
        cipher.final(),
      ]);
      return [
        initializationVector.toString('base64url'),
        cipher.getAuthTag().toString('base64url'),
        ciphertext.toString('base64url'),
      ].join('.');
    },
    unseal(value: string): { nonce: string; codeVerifier: string } {
      const [encodedIv, encodedTag, encodedCiphertext, extra] =
        value.split('.');
      if (!encodedIv || !encodedTag || !encodedCiphertext || extra)
        throw new Error('Invalid external authorization transaction');
      const initializationVector = Buffer.from(encodedIv, 'base64url');
      const authenticationTag = Buffer.from(encodedTag, 'base64url');
      if (initializationVector.length !== 12 || authenticationTag.length !== 16)
        throw new Error('Invalid external authorization transaction');
      const decipher = createDecipheriv(
        'aes-256-gcm',
        encryptionKey,
        initializationVector,
      );
      decipher.setAuthTag(authenticationTag);
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
      const parsed: unknown = JSON.parse(plaintext);
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        typeof (parsed as Record<string, unknown>).nonce !== 'string' ||
        typeof (parsed as Record<string, unknown>).codeVerifier !== 'string'
      )
        throw new Error('Invalid external authorization transaction');
      return parsed as { nonce: string; codeVerifier: string };
    },
  };
}
