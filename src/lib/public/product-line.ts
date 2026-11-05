import { addDays } from "@/lib/days";
import { formatWhole } from "@/lib/format";
import type { PublicNumber } from "./snapshot";

/** How old the latest value can be and still show ("hide the line if there's no recent value"). */
export const RECENT_DAYS = 7;

/**
 * The public card's line of product numbers, e.g. "1,240 open jobs · 300 companies": each public
 * product number's latest daily value, with commas, labelled in lower case. Null when there's
 * nothing recent to show.
 */
export function productLine(numbers: Pick<PublicNumber, "kind" | "label" | "figure" | "latestDay">[], today: string): string | null {
	const earliest = addDays(today, -RECENT_DAYS);
	const parts = numbers
		.filter((n) => n.kind === "latest" && n.figure !== null && n.latestDay !== null && n.latestDay >= earliest)
		.map((n) => `${formatWhole(n.figure!)} ${n.label.toLowerCase()}`);
	return parts.length ? parts.join(" · ") : null;
}

/** {key} placeholders in a tagline, e.g. {open_jobs}. */
export const PLACEHOLDER = /\{([a-z0-9_]+)\}/g;

/** The keys a tagline's placeholders use, in order. */
export function taglineKeys(tagline: string): string[] {
	return [...tagline.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

/** A piece of a filled-in tagline: plain text, or a number (shown in bold). */
export type TaglinePart = { text: string; number?: true };

/**
 * The tagline as the public card shows it, in pieces: each {key} replaced by that public product
 * number's latest daily value, with commas, marked as a number ("4,868" real tech jobs, straight
 * from "838" companies). If any placeholder can't be filled (not a public number, no value, or
 * over RECENT_DAYS old), the fallback is shown instead, so a half-filled or stale tagline never appears.
 */
export function fillTaglineParts(tagline: string, fallback: string, numbers: Pick<PublicNumber, "key" | "kind" | "figure" | "latestDay">[], today: string): TaglinePart[] {
	const earliest = addDays(today, -RECENT_DAYS);
	const values = new Map(
		numbers.filter((n) => n.kind === "latest" && n.figure !== null && n.latestDay !== null && n.latestDay >= earliest).map((n) => [n.key, formatWhole(n.figure!)]),
	);
	return fillParts(tagline, values) ?? (fallback ? [{ text: fallback }] : []);
}

/**
 * One of a project's outcomes ("{open_jobs} jobs made clear"), filled in the same way, or null
 * when any number can't be (not public, no value, or over RECENT_DAYS old): then it's left out.
 * Counts like {visitors} use their 30-day total.
 */
export function fillOutcome(template: string, numbers: Pick<PublicNumber, "key" | "kind" | "figure" | "latestDay">[], today: string): TaglinePart[] | null {
	const earliest = addDays(today, -RECENT_DAYS);
	const values = new Map(
		numbers
			.filter((n) => n.figure !== null && (n.kind === "count" || (n.latestDay !== null && n.latestDay >= earliest)))
			.map((n) => [n.key, formatWhole(n.figure!)]),
	);
	return taglineKeys(template).length ? fillParts(template, values) : null;
}

/** Splits a template into text and numbers, or null if a placeholder has no value. */
function fillParts(template: string, values: Map<string, string>): TaglinePart[] | null {
	if (!taglineKeys(template).every((key) => values.has(key))) return null;
	const parts: TaglinePart[] = [];
	let last = 0;
	for (const match of template.matchAll(PLACEHOLDER)) {
		if (match.index > last) parts.push({ text: template.slice(last, match.index) });
		parts.push({ text: values.get(match[1])!, number: true });
		last = match.index + match[0].length;
	}
	if (last < template.length) parts.push({ text: template.slice(last) });
	return parts;
}

/** The filled-in tagline as plain text ("4,868 real tech jobs, straight from 838 companies"). */
export function fillTagline(tagline: string, fallback: string, numbers: Pick<PublicNumber, "key" | "kind" | "figure" | "latestDay">[], today: string): string {
	return fillTaglineParts(tagline, fallback, numbers, today)
		.map((p) => p.text)
		.join("");
}
