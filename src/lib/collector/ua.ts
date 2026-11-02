/**
 * Broad groups from the User-Agent header. The header itself is never stored.
 * Order matters: e.g. Edge and Opera also say "Chrome", Chrome also says "Safari".
 */

export type Device = "desktop" | "mobile" | "tablet" | "other";
export type Browser = "chrome" | "safari" | "firefox" | "edge" | "samsung" | "opera" | "other";
export type Os = "windows" | "macos" | "ios" | "android" | "linux" | "chromeos" | "other";

const BOT_PATTERN =
	/bot\b|bot\/|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|curl\/|wget\/|python-requests|httpclient|axios\/|node-fetch|go-http-client|uptime|monitor/i;

export function isBot(ua: string): boolean {
	return ua.trim() === "" || BOT_PATTERN.test(ua);
}

export function deviceGroup(ua: string, mobileHint: string | null = null): Device {
	if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
	if (mobileHint === "?1" || /Mobi|iPhone|iPod|Android/i.test(ua)) return "mobile";
	if (/Windows|Macintosh|Mac OS X|X11|Linux|CrOS/i.test(ua)) return "desktop";
	return "other";
}

export function browserGroup(ua: string): Browser {
	if (/SamsungBrowser/i.test(ua)) return "samsung";
	if (/OPR\/|Opera|OPT\//i.test(ua)) return "opera";
	if (/Edg(e|A|iOS)?\//i.test(ua)) return "edge";
	if (/Firefox\/|FxiOS/i.test(ua)) return "firefox";
	if (/Chrome\/|CriOS|Chromium/i.test(ua)) return "chrome";
	if (/Safari\//i.test(ua) && /Version\//i.test(ua)) return "safari";
	return "other";
}

export function osGroup(ua: string): Os {
	if (/Windows/i.test(ua)) return "windows";
	if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
	if (/Android/i.test(ua)) return "android";
	if (/CrOS/i.test(ua)) return "chromeos";
	if (/Mac OS X|Macintosh/i.test(ua)) return "macos";
	if (/Linux|X11/i.test(ua)) return "linux";
	return "other";
}
