import crypto from "crypto";

/**
 * API secrets are high-entropy (192-bit random `sk_…`), so a fast hash + a
 * constant-time compare is the right primitive (bcrypt/argon2 are for
 * low-entropy human passwords). We store ONLY the hash; the plaintext secret is
 * shown to the merchant once at creation and never persisted.
 */
export function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

/** Constant-time compare of a presented secret against a stored hash. */
export function verifySecret(presented: string, storedHash: string): boolean {
  if (!presented || !storedHash) return false;
  const a = Buffer.from(hashSecret(presented), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
