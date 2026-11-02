import { Marked, type Tokens } from "marked";

/**
 * Markdown to safe HTML for journey entries and project descriptions (admin preview and the
 * public pages use the same function).
 *
 * Safety comes from never passing HTML through, rather than cleaning it afterwards:
 * - Any raw HTML in the Markdown is shown as text (escaped), never as tags.
 * - Links may only be http(s), mailto or a path on this site. Anything else (javascript:,
 *   data:, vbscript:, …) becomes plain text. External links get rel="noopener noreferrer".
 * - Images may only come from this site (a path starting with /), which is also all the CSP allows.
 * - Everything else is produced by marked, which escapes text and attribute values.
 */

const escapeHtml = (value: string) =>
	value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Decodes the few entities that could hide a scheme (e.g. "javascript&#58;"). */
function decodeEntities(value: string): string {
	return value
		.replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
		.replace(/&#(\d+);?/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
		.replace(/&colon;/gi, ":")
		.replace(/&tab;|&newline;/gi, "");
}

export type SafeUrl = { href: string; external: boolean } | null;

/** http(s), mailto, or a same-site path. Returns null for anything else. */
export function safeLinkUrl(raw: string): SafeUrl {
	const value = decodeEntities(raw).replace(/[\u0000- \u007f-\u009f]/g, "");
	if (/^\/(?!\/)/.test(value) || /^#[\w-]*$/.test(value)) return { href: value, external: false };
	try {
		const url = new URL(value);
		if (url.protocol === "https:" || url.protocol === "http:") return { href: url.toString(), external: true };
		if (url.protocol === "mailto:") return { href: url.toString(), external: false };
	} catch {
		// not an absolute URL
	}
	return null;
}

/** Same-site image paths only. */
export function safeImageUrl(raw: string): string | null {
	const value = decodeEntities(raw).replace(/[\u0000- \u007f-\u009f]/g, "");
	return /^\/(?!\/)[^"'<>\\]*$/.test(value) ? value : null;
}

const markdown = new Marked({
	gfm: true,
	breaks: false,
	renderer: {
		html({ text }: Tokens.HTML | Tokens.Tag) {
			return escapeHtml(text);
		},
		link(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, { href, title, tokens }: Tokens.Link) {
			const text = this.parser.parseInline(tokens);
			const url = safeLinkUrl(href);
			if (!url) return text;
			const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
			const rel = url.external ? ' rel="noopener noreferrer"' : "";
			return `<a href="${escapeHtml(url.href)}"${titleAttr}${rel}>${text}</a>`;
		},
		image({ href, title, text }: Tokens.Image) {
			const src = safeImageUrl(href);
			if (!src) return escapeHtml(text);
			const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
			return `<img src="${escapeHtml(src)}" alt="${escapeHtml(text)}"${titleAttr} loading="lazy">`;
		},
	},
});

export const MARKDOWN_MAX_LENGTH = 50_000;

/** Safe HTML from Markdown. */
export function renderMarkdown(source: string): string {
	return markdown.parse(source.slice(0, MARKDOWN_MAX_LENGTH), { async: false }) as string;
}
