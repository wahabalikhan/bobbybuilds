/**
 * Project keys.
 * - Public key (pk_…): goes in the t.js snippet. Not a secret; it only says which project.
 * - Secret key (sk_…): used server-side for /v1/events and /v1/metrics. Shown once when
 *   created, then stored only as a SHA-256 hash. SHA-256 is enough here because the key is
 *   ~238 bits of randomness, so there's nothing to brute-force.
 *
 * No imports, so scripts/keys-create.ts can use this file directly with Node.
 */

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const PUBLIC_KEY_PATTERN = /^pk_[A-Za-z0-9]{24}$/;
export const SECRET_KEY_PATTERN = /^sk_[A-Za-z0-9]{40}$/;

/** Uniformly random base62 string (rejection sampling avoids modulo bias). */
export function randomBase62(length: number): string {
	let out = "";
	const bytes = new Uint8Array(length * 2);
	while (out.length < length) {
		crypto.getRandomValues(bytes);
		for (const byte of bytes) {
			if (byte < 248 && out.length < length) out += BASE62[byte % 62];
		}
	}
	return out;
}

export function createPublicKey(): string {
	return `pk_${randomBase62(24)}`;
}

export function createSecretKey(): string {
	return `sk_${randomBase62(40)}`;
}

/** `bytes` random bytes as lower-case hex (e.g. the daily secret). */
export function randomHex(bytes: number): string {
	const values = crypto.getRandomValues(new Uint8Array(bytes));
	return Array.from(values, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hashSecretKey(secretKey: string): Promise<string> {
	return sha256Hex(secretKey);
}

/** Last four characters, so settings can show which key is live without revealing it. */
export function secretKeyHint(secretKey: string): string {
	return secretKey.slice(-4);
}
