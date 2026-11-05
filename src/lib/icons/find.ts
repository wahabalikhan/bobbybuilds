/**
 * Finds a project's current icon on its live site, in this order:
 *   1. its SVG icon: a <link rel="icon"> that's SVG, else /icon.svg
 *   2. its apple-touch-icon: the largest <link rel="apple-touch-icon">, else /apple-touch-icon.png
 *   3. the largest icon in its web manifest (<link rel="manifest">)
 *   4. its favicon: the first other <link rel="icon">, else /favicon.ico
 * Every candidate must really be an image of an allowed type, at most MAX_BYTES. SVGs stay SVG, but
 * only clean ones (no scripts, event handlers, external references or embedded HTML), because the
 * stored copy is served from this site.
 */
export type Fetch = typeof fetch;
export type IconKind = "svg" | "apple-touch-icon" | "manifest" | "favicon";
export type FoundIcon = { data: Uint8Array; contentType: string; kind: IconKind; sourceUrl: string };

export const MAX_BYTES = 256 * 1024;
const TIMEOUT_MS = 8000;
const UA = "BobbyBuilds icon check (https://bobbybuilds.app)";

type Link = { rel: string[]; href: string; type: string; sizes: number };

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(2).find((v) => v !== undefined) ?? "";

/** The largest dimension in a sizes attribute ("16x16 32x32" → 32, "any" → 1024, none → 0). */
function largest(sizes: string): number {
	if (/\bany\b/i.test(sizes)) return 1024;
	return Math.max(0, ...[...sizes.matchAll(/(\d+)\s*x\s*(\d+)/gi)].map((m) => Number(m[1])));
}

/** The <link> tags in a page's HTML, with absolute hrefs. */
export function iconLinks(html: string, base: string): Link[] {
	const links: Link[] = [];
	for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
		const rel = attr(tag, "rel").toLowerCase().split(/\s+/).filter(Boolean);
		const href = attr(tag, "href");
		if (!href || !rel.length) continue;
		try {
			links.push({ rel, href: new URL(href, base).toString(), type: attr(tag, "type").toLowerCase(), sizes: largest(attr(tag, "sizes")) });
		} catch {
			continue;
		}
	}
	return links;
}

/** What a file really is, from its first bytes (null when it isn't an allowed image). */
export function sniff(data: Uint8Array): string | null {
	const b = data;
	if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
	if (b.length >= 4 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return "image/x-icon";
	if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
	if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
	const head = new TextDecoder().decode(b.slice(0, 2048)).replace(/^﻿/, "").trimStart();
	if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head)) return "image/svg+xml";
	return null;
}

/** True when an SVG is safe to serve from this site: nothing that could run or load something else. */
export function cleanSvg(text: string): boolean {
	return !/<script|<foreignObject|<iframe|<embed|<object|<use\b[^>]*href\s*=\s*["'](?!#)|\son[a-z]+\s*=|javascript:|(?:xlink:)?href\s*=\s*["'](?!#|data:image\/)|url\(\s*["']?(?!#|data:image\/)/i.test(text);
}

async function get(fetchFn: Fetch, url: string, accept: string): Promise<{ ok: boolean; status: number; data: Uint8Array; type: string; url: string } | null> {
	try {
		const response = await fetchFn(url, { headers: { "User-Agent": UA, Accept: accept }, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
		const length = Number(response.headers.get("content-length") ?? "0");
		if (!response.ok || length > MAX_BYTES * 4) return { ok: false, status: response.status, data: new Uint8Array(), type: "", url };
		const data = new Uint8Array(await response.arrayBuffer());
		return { ok: true, status: response.status, data, type: (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase(), url: response.url || url };
	} catch {
		return null;
	}
}

/** Fetches one candidate and checks it's an allowed image (SVG only when `svg` is allowed and clean). */
async function tryIcon(fetchFn: Fetch, url: string, kind: IconKind, allowSvg: boolean): Promise<FoundIcon | null> {
	if (!url.startsWith("https://")) return null;
	const got = await get(fetchFn, url, "image/svg+xml,image/png,image/x-icon,image/*;q=0.8");
	if (!got?.ok || got.data.length === 0 || got.data.length > MAX_BYTES) return null;
	const type = sniff(got.data);
	if (!type || (type === "image/svg+xml" && (!allowSvg || !cleanSvg(new TextDecoder().decode(got.data))))) return null;
	const finalUrl = got.url.startsWith("https://") ? got.url : url;
	return { data: got.data, contentType: type, kind, sourceUrl: finalUrl.slice(0, 500) };
}

export async function findIcon(fetchFn: Fetch, siteUrl: string): Promise<FoundIcon | { error: string }> {
	let origin: string;
	try {
		origin = new URL(siteUrl).origin;
	} catch {
		return { error: "The site address isn't valid." };
	}
	const page = await get(fetchFn, siteUrl, "text/html");
	const links = page?.ok ? iconLinks(new TextDecoder().decode(page.data.slice(0, 512 * 1024)), page.url || siteUrl) : [];
	const icons = links.filter((l) => l.rel.includes("icon"));
	const bySize = (a: Link, b: Link) => b.sizes - a.sizes;

	// 1. SVG
	const svgLinks = icons.filter((l) => l.type === "image/svg+xml" || /\.svg(\?|#|$)/i.test(l.href));
	for (const url of [...svgLinks.map((l) => l.href), `${origin}/icon.svg`]) {
		const found = await tryIcon(fetchFn, url, "svg", true);
		if (found?.contentType === "image/svg+xml") return found;
	}
	// 2. apple-touch-icon
	const apple = links.filter((l) => l.rel.includes("apple-touch-icon") || l.rel.includes("apple-touch-icon-precomposed")).sort(bySize);
	for (const url of [...apple.map((l) => l.href), `${origin}/apple-touch-icon.png`]) {
		const found = await tryIcon(fetchFn, url, "apple-touch-icon", false);
		if (found) return found;
	}
	// 3. the largest icon in the web manifest
	const manifestLink = links.find((l) => l.rel.includes("manifest"));
	if (manifestLink) {
		const got = await get(fetchFn, manifestLink.href, "application/manifest+json,application/json");
		if (got?.ok && got.data.length <= MAX_BYTES) {
			try {
				const manifest = JSON.parse(new TextDecoder().decode(got.data)) as { icons?: { src?: string; sizes?: string; purpose?: string }[] };
				const candidates = (manifest.icons ?? [])
					.filter((i) => typeof i.src === "string" && !/\bmaskable\b/.test(i.purpose ?? "") )
					.map((i) => ({ href: new URL(i.src!, got.url || manifestLink.href).toString(), sizes: largest(i.sizes ?? "") }))
					.sort((a, b) => b.sizes - a.sizes);
				for (const c of candidates) {
					const found = await tryIcon(fetchFn, c.href, "manifest", true);
					if (found) return found;
				}
			} catch {
				// Not JSON: skip the manifest.
			}
		}
	}
	// 4. the favicon: any other declared icon, then /favicon.ico
	const others = icons.filter((l) => !svgLinks.includes(l)).sort(bySize);
	for (const url of [...others.map((l) => l.href), `${origin}/favicon.ico`]) {
		const found = await tryIcon(fetchFn, url, "favicon", false);
		if (found) return found;
	}
	return { error: page?.ok ? "No usable icon on the site." : page ? `The site answered ${page.status}.` : "The site couldn't be reached." };
}
