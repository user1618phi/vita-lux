import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

/* promisify() cannot see scrypt's 5-argument overload, so the options-taking
   form is wrapped by hand rather than cast away. */
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

/* Password hashing, PII encryption and hashing.

   Everything here uses node:crypto — no dependency, no native build on a small
   host. Two separate secrets are required in production:

     APP_ENCRYPTION_KEY — 32 bytes, base64. Encrypts customer name/phone/address.
     APP_HASH_SALT      — any long random string. Salts the lookup hashes.

   The database is hosted outside Kazakhstan for now, so a dump must not be a
   dump of personal data. See CLAUDE.md. */

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

/* ── passwords (admin login) ───────────────────────────────────────────── */

/** `scrypt$N$r$p$salt$hash`, all base64. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password.normalize("NFKC"), salt, SCRYPT_KEYLEN, SCRYPT_PARAMS)) as Buffer;
  const { N, r, p } = SCRYPT_PARAMS;
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

/** Constant-time verify. Returns false on any malformed stored value. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const derived = (await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    })) as Buffer;
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/* ── session tokens ────────────────────────────────────────────────────── */

/** A fresh 256-bit session token. Only its hash is ever stored. */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Tokens are high-entropy already, so a plain keyed digest is enough. */
export function hashToken(token: string): string {
  return createHmac("sha256", hashSalt()).update(token).digest("base64url");
}

/* ── PII ───────────────────────────────────────────────────────────────── */

/** AES-256-GCM. Returns `v1.iv.tag.ciphertext`, base64url. */
export function encryptPii(plaintext: string): string {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

/** Inverse of `encryptPii`. Throws if the payload was tampered with. */
export function decryptPii(payload: string): string {
  const [version, ivB64, tagB64, ctB64] = payload.split(".");
  if (version !== "v1") throw new Error(`unsupported ciphertext version: ${version}`);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}

/** Deterministic lookup hash — lets orders be found by phone without decrypting. */
export function hashPii(value: string): string {
  return createHmac("sha256", hashSalt()).update(value.trim().toLowerCase()).digest("hex");
}

/* ── secrets ───────────────────────────────────────────────────────────── */

function encryptionKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "APP_ENCRYPTION_KEY is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`APP_ENCRYPTION_KEY must decode to exactly 32 bytes, got ${key.length}`);
  }
  return key;
}

function hashSalt(): string {
  const salt = process.env.APP_HASH_SALT;
  if (!salt) throw new Error("APP_HASH_SALT is not set.");
  return salt;
}
