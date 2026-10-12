// Password hashing - PBKDF2-SHA512, format tersimpan: "<saltHex>:<hashHex>"
// Format & parameter identik dengan yang dipakai routes/auth.ts sebelumnya.
import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';

const ITERATIONS = 100_000;
const KEYLEN = 64;
const DIGEST = 'sha512';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

/** Verifikasi password dengan perbandingan constant-time. */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;

  const verifyHash = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST);
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== verifyHash.length) return false;
  return timingSafeEqual(expected, verifyHash);
}
