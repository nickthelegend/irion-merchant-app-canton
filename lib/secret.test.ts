import { test } from "node:test"
import assert from "node:assert/strict"
import { hashSecret, verifySecret } from "./secret.ts"

test("hashSecret: deterministic sha256 hex (64 chars)", () => {
  const h = hashSecret("sk_abc")
  assert.equal(h, hashSecret("sk_abc"))
  assert.match(h, /^[0-9a-f]{64}$/)
})

test("hashSecret: different inputs → different digests", () => {
  assert.notEqual(hashSecret("sk_a"), hashSecret("sk_b"))
})

test("verifySecret: accepts the matching secret", () => {
  const secret = "sk_live_" + "x".repeat(32)
  assert.equal(verifySecret(secret, hashSecret(secret)), true)
})

test("verifySecret: rejects a wrong secret", () => {
  assert.equal(verifySecret("wrong", hashSecret("right")), false)
})

test("verifySecret: rejects empty / missing inputs", () => {
  assert.equal(verifySecret("", hashSecret("x")), false)
  assert.equal(verifySecret("x", ""), false)
  assert.equal(verifySecret("", ""), false)
})

test("verifySecret: rejects a malformed stored hash without throwing", () => {
  // a length-mismatched buffer must be rejected BEFORE timingSafeEqual (which throws on unequal lengths)
  assert.equal(verifySecret("x", "deadbeef"), false)
})
