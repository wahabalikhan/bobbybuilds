import { addDays, isDay, utcDay } from "@/lib/days";

/** Date ranges for the dashboard, from URL parameters. Days are UTC and inclusive. */

export const RANGE_PRESETS = {
	"7d": { label: "Last 7 days", days: 7 },
	"30d": { label: "Last 30 days", days: 30 },
	"90d": { label: "Last 90 days", days: 90 },
	"12m": { label: "Last 12 months", days: 365 },
} as const;

export type RangeKey = keyof typeof RANGE_PRESETS | "custom";

export type DateRange = {
	key: RangeKey;
	label: string;
	from: string;
	to: string;
	days: number;
	/** The same number of days immediately before. */
	previousFrom: string;
	previousTo: string;
};

const MAX_CUSTOM_DAYS = 731;

function build(key: RangeKey, label: string, from: string, to: string): DateRange {
	const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
	return { key, label, from, to, days, previousFrom: addDays(from, -days), previousTo: addDays(from, -1) };
}

export function parseRange(params: { range?: string; from?: string; to?: string }, today: string = utcDay()): DateRange {
	if (params.range === "custom" && params.from && params.to && isDay(params.from) && isDay(params.to)) {
		let from = params.from <= params.to ? params.from : params.to;
		let to = params.from <= params.to ? params.to : params.from;
		if (to > today) to = today;
		if (from > to) from = to;
		if (Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1 > MAX_CUSTOM_DAYS) from = addDays(to, -(MAX_CUSTOM_DAYS - 1));
		return build("custom", `${from} to ${to}`, from, to);
	}
	const key = (params.range && params.range in RANGE_PRESETS ? params.range : "30d") as keyof typeof RANGE_PRESETS;
	const preset = RANGE_PRESETS[key];
	return build(key, preset.label, addDays(today, -(preset.days - 1)), today);
}

/** Every day from `from` to `to`, inclusive. */
export function daysBetween(from: string, to: string): string[] {
	const days: string[] = [];
	for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
	return days;
}

/** Raw page views and events are kept for 90 days, so raw-data sections can only cover that. */
export function clampToRaw(range: DateRange, today: string = utcDay()): { from: string; to: string; clipped: boolean } {
	const earliest = addDays(today, -90);
	return { from: range.from < earliest ? earliest : range.from, to: range.to, clipped: range.from < earliest };
}
