import { generateKeyPairSync } from 'node:crypto';
import { decodeProtectedHeader, importSPKI, jwtVerify } from 'jose';
import { describe, expect, it } from 'vitest';
import { createAppleClientSecret } from './apple-client-secret.js';

describe('Apple client secret [user-login REQ-015]', () => {
  it('signs a bounded ES256 client assertion from configured signing material', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
    });
    const secret = await createAppleClientSecret({
      clientId: 'io.hansel.web',
      teamId: 'TEAM123',
      keyId: 'KEY123',
      privateKey: privateKey
        .export({ type: 'pkcs8', format: 'pem' })
        .toString(),
      now: new Date('2026-08-30T00:00:00.000Z'),
    });
    expect(decodeProtectedHeader(secret)).toMatchObject({
      alg: 'ES256',
      kid: 'KEY123',
    });
    const verificationKey = await importSPKI(
      publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      'ES256',
    );
    const verified = await jwtVerify(secret, verificationKey, {
      audience: 'https://appleid.apple.com',
      issuer: 'TEAM123',
      subject: 'io.hansel.web',
      currentDate: new Date('2026-08-30T00:00:00.000Z'),
    });
    const { exp, iat } = verified.payload;
    if (typeof exp !== 'number' || typeof iat !== 'number')
      throw new Error('Apple client secret must contain numeric timestamps');
    expect(exp - iat).toBe(180 * 24 * 60 * 60);
  });
});
