const crypto = require("node:crypto");

const HASH_ALGORITHM = "sha256";
const HASH_ITERATIONS = 210000;
const HASH_KEY_LENGTH = 32;

function toBase64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_ALGORITHM)
    .toString("hex");

  return `pbkdf2_${HASH_ALGORITHM}$${HASH_ITERATIONS}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const [algorithmName, iterationsText, salt, expectedHash] = String(storedHash || "").split("$");

  if (algorithmName !== `pbkdf2_${HASH_ALGORITHM}` || !iterationsText || !salt || !expectedHash) {
    return false;
  }

  const iterations = Number(iterationsText);
  const actualHash = crypto
    .pbkdf2Sync(password, salt, iterations, HASH_KEY_LENGTH, HASH_ALGORITHM)
    .toString("hex");

  const actual = Buffer.from(actualHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function signSession(payload, secret) {
  const body = toBase64Url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");

  return `${body}.${signature}`;
}

function verifySession(token, secret) {
  const [body, signature] = String(token || "").split(".");

  if (!body || !signature) {
    return null;
  }

  const expectedSignature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return null;
  }

  const payload = JSON.parse(fromBase64Url(body).toString("utf8"));

  if (!payload.exp || Date.now() > payload.exp) {
    return null;
  }

  return payload;
}

module.exports = {
  hashPassword,
  signSession,
  verifyPassword,
  verifySession
};
