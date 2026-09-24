import {
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const PIN_LENGTH = 6;
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

/**
 * Generate PIN aktivasi 6 digit.
 *
 * Contoh:
 * 583921
 */
export function generateActivationPin(): string {
  const min = 10 ** (PIN_LENGTH - 1);
  const max = 10 ** PIN_LENGTH;

  return randomInt(min, max).toString();
}

/**
 * Hash PIN menggunakan scrypt + random salt.
 *
 * Yang disimpan di database BUKAN PIN asli.
 *
 * Format:
 * salt:hash
 */
export function hashActivationPin(pin: string): string {
  const normalizedPin = String(pin).trim();

  if (!/^\d{6}$/.test(normalizedPin)) {
    throw new Error("PIN aktivasi harus terdiri dari 6 digit.");
  }

  const salt = randomBytes(SALT_LENGTH);

  const derivedKey = scryptSync(
    normalizedPin,
    salt,
    KEY_LENGTH
  );

  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

/**
 * Verifikasi PIN terhadap hash yang tersimpan di database.
 */
export function verifyActivationPin(
  pin: string,
  storedHash: string
): boolean {
  try {
    const normalizedPin = String(pin).trim();

    if (!/^\d{6}$/.test(normalizedPin)) {
      return false;
    }

    if (!storedHash || !storedHash.includes(":")) {
      return false;
    }

    const [saltHex, hashHex] = storedHash.split(":");

    if (!saltHex || !hashHex) {
      return false;
    }

    const salt = Buffer.from(saltHex, "hex");
    const storedKey = Buffer.from(hashHex, "hex");

    const derivedKey = scryptSync(
      normalizedPin,
      salt,
      storedKey.length
    );

    if (derivedKey.length !== storedKey.length) {
      return false;
    }

    return timingSafeEqual(derivedKey, storedKey);
  } catch {
    return false;
  }
}
