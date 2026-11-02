/**
 * Field validation and cleaning for the collector. Limits match the CHECK constraints in
 * migrations/. Structural fields (key, path, numbers) are validated strictly; marketing
 * fields anyone can type into a URL (ref, utm_*, referrer) are cleaned and dropped if junk.
 */

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/** True if a string looks like an email address or a phone number. */
export function looksPersonal(value: string): boolean {
	if (EMAIL_PATTERN.test(value)) return true;
	const digits = value.replace(/\D/g, "");
	return digits.length >= 9 && /^[+\d\s().-]+$/.test(value.trim());
}

export function isPath(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.length >= 1 &&
		value.length <= 200 &&
		value.startsWith("/") &&
		!/[?#\u0000-\u001f\u007f]/.test(value) &&
		!looksPersonal(value)
	);
}

export function isWholeNumber(value: unknown, min: number, max: number): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

/** ref: letters, numbers and hyphens, up to 40. Anything else is dropped. */
export function cleanRef(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return /^[A-Za-z0-9-]{1,40}$/.test(trimmed) ? trimmed : null;
}

/** utm_*: lower-cased, spaces become hyphens, only a-z 0-9 . _ - kept, up to 50. */
export function cleanUtm(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const cleaned = value
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9._-]/g, "");
	if (!cleaned || cleaned.length > 50 || looksPersonal(value)) return null;
	return cleaned;
}

const HOSTNAME_PATTERN = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

/** A bare hostname, lower-cased, without a leading "www.". */
export function cleanDomain(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const host = value.trim().toLowerCase().replace(/^www\./, "");
	return HOSTNAME_PATTERN.test(host) ? host : null;
}

/** Referrer domain, or null if missing, junk, or the site's own domain. */
export function cleanReferrer(value: unknown, siteOrigin: string): string | null {
	const domain = cleanDomain(value);
	if (!domain) return null;
	const siteHost = new URL(siteOrigin).hostname.replace(/^www\./, "");
	return domain === siteHost ? null : domain;
}

/** Primary language subtag only: "en-GB" → "en". */
export function cleanLanguage(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const primary = value.split(/[-_]/)[0].toLowerCase();
	return /^[a-z]{2,3}$/.test(primary) ? primary : null;
}

export type ScreenGroup = "small" | "medium" | "large" | "xlarge" | "unknown";

export function screenGroup(width: number | null): ScreenGroup {
	if (width === null || width <= 0) return "unknown";
	if (width < 640) return "small";
	if (width < 1024) return "medium";
	if (width < 1440) return "large";
	return "xlarge";
}

/** Cloudflare's two-letter country, or null for unknown (XX) and Tor (T1). */
export function cleanCountry(value: unknown): string | null {
	return typeof value === "string" && /^[A-Z]{2}$/.test(value) && value !== "XX" ? value : null;
}

export function isEventName(value: unknown): value is string {
	return typeof value === "string" && /^[a-z][a-z0-9_.-]{0,63}$/.test(value);
}

export type Props = Record<string, string | number | boolean>;
export type PropsResult = { ok: true; props: Props } | { ok: false; message: string };

/** Small flat object: up to 10 keys, short values, nothing that looks personal, 1 KB in total. */
export function validateProps(value: unknown): PropsResult {
	if (value === undefined || value === null) return { ok: true, props: {} };
	if (typeof value !== "object" || Array.isArray(value)) return { ok: false, message: "props must be an object." };

	const entries = Object.entries(value as Record<string, unknown>);
	if (entries.length > 10) return { ok: false, message: "props can have at most 10 keys." };

	const props: Props = {};
	for (const [key, item] of entries) {
		if (!/^[a-z][a-z0-9_]{0,31}$/.test(key)) return { ok: false, message: `props key "${key.slice(0, 40)}" isn't allowed.` };
		if (typeof item === "string") {
			if (item.length > 100) return { ok: false, message: `props.${key} is longer than 100 characters.` };
			if (looksPersonal(item)) return { ok: false, message: `props.${key} looks like personal data.` };
		} else if (typeof item === "number") {
			if (!Number.isFinite(item)) return { ok: false, message: `props.${key} must be a finite number.` };
		} else if (typeof item !== "boolean") {
			return { ok: false, message: `props.${key} must be a string, number or true/false.` };
		}
		props[key] = item;
	}
	if (JSON.stringify(props).length > 1024) return { ok: false, message: "props are larger than 1 KB." };
	return { ok: true, props };
}

/** File types recorded as downloads. Keep in sync with src/tracker/core.ts. */
export const DOWNLOAD_TYPES = [
	"pdf", "zip", "docx", "doc", "xlsx", "xls", "csv", "pptx", "ppt", "key", "pages", "numbers",
	"txt", "rtf", "epub", "dmg", "exe", "msi", "pkg", "apk", "mp3", "mp4", "mov", "fig", "sketch",
] as const;

/**
 * Built-in events the tracker sends for every project, with exact prop shapes.
 * They don't need to be on a project's allowlist.
 */
export const BUILT_IN_EVENTS: Record<string, (props: Props) => string | null> = {
	outbound_click: (props) => (only(props, ["domain"]) && cleanDomain(props.domain) === props.domain ? null : "outbound_click needs { domain }."),
	file_download: (props) =>
		only(props, ["file", "type"]) &&
		typeof props.file === "string" &&
		/^[^/\\\u0000-\u001f]{1,100}$/.test(props.file) &&
		(DOWNLOAD_TYPES as readonly string[]).includes(String(props.type))
			? null
			: "file_download needs { file, type } with a known file type.",
	not_found: (props) => (only(props, []) ? null : "not_found takes no props."),
	form_started: (props) => formProps(props, "form_started"),
	form_submitted: (props) => formProps(props, "form_submitted"),
};

function only(props: Props, keys: string[]): boolean {
	const actual = Object.keys(props);
	return actual.length === keys.length && keys.every((key) => key in props);
}

function formProps(props: Props, name: string): string | null {
	return only(props, ["form"]) && typeof props.form === "string" && /^[a-z0-9][a-z0-9_-]{0,39}$/.test(props.form)
		? null
		: `${name} needs { form } (lower-case letters, numbers, - or _).`;
}
