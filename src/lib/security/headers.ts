/**
 * Security headers for every page.
 *
 * Two CSPs:
 * - Public pages are cached (10 minutes, Phase 6), so the same HTML is served to many
 *   visitors. A per-request nonce can't work there, so they get a fixed policy.
 *   Next.js's App Router streams its data in inline <script> tags, so script-src needs
 *   'unsafe-inline'; everything else is locked to this site only.
 * - /admin is always rendered fresh and never cached, so it gets a per-request nonce
 *   with 'strict-dynamic': only scripts Next.js stamped with this request's nonce run.
 */

const isDev = process.env.NODE_ENV === "development";

// Next.js dev mode (hot reload) needs eval. Never sent in production.
const devEval = isDev ? " 'unsafe-eval'" : "";

const sharedDirectives = [
	"default-src 'self'",
	"base-uri 'none'",
	"object-src 'none'",
	"frame-ancestors 'none'",
	"form-action 'self'",
	"img-src 'self' data: blob:",
	"font-src 'self'",
	// React style={} attributes need this. Inline styles can't run code.
	"style-src 'self' 'unsafe-inline'",
	"connect-src 'self'",
	"manifest-src 'self'",
	"worker-src 'self'",
	...(isDev ? [] : ["upgrade-insecure-requests"]),
];

export function publicCsp(): string {
	return [...sharedDirectives, `script-src 'self' 'unsafe-inline'${devEval}`].join("; ");
}

export function adminCsp(nonce: string): string {
	return [...sharedDirectives, `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`].join("; ");
}

export const securityHeaders: Record<string, string> = {
	"Strict-Transport-Security": "max-age=63072000; includeSubDomains",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy":
		"camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()",
	"Cross-Origin-Opener-Policy": "same-origin",
	"Cross-Origin-Resource-Policy": "same-origin",
};

export const adminOnlyHeaders: Record<string, string> = {
	"Cache-Control": "private, no-store",
	"X-Robots-Tag": "noindex, nofollow",
};

export function createNonce(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes));
}
