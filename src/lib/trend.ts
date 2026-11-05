import { addDays, weekStart } from "@/lib/days";

export type TrendPoint = { day: string; value: number };

/** A project card's visitors chart: per day for a project's first four weeks, then per week (up to 12). */
export type Trend = { period: "day" | "week"; points: TrendPoint[] };

/** Days from `from` to `to`, counting both. */
function span(from: string, to: string): number {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/**
 * When a project's charts start: the later of its "Started on" date and its first tracked visit
 * (either may be missing). Null when neither is known.
 */
export function chartStart(startedOn: string | null, firstTracked: string | null): string | null {
	if (startedOn && firstTracked) return startedOn > firstTracked ? startedOn : firstTracked;
	return startedOn ?? firstTracked;
}

/**
 * The trend from a daily series (which must cover `start` to `today`), starting at `start`: daily
 * points when that's under 28 days ago, otherwise weekly points (Monday-start) from its week, at
 * most the last 12 weeks. Without a start (or one over 12 weeks ago), the last 12 weeks.
 */
export function trendFrom(daily: TrendPoint[], today: string, start: string | null): Trend {
	const value = (day: string) => daily.find((d) => d.day === day)?.value ?? 0;
	const thisWeek = weekStart(today);
	const twelveWeeksAgo = addDays(thisWeek, -7 * 11);
	if (start && start <= today && span(start, today) < 28) {
		return { period: "day", points: Array.from({ length: span(start, today) }, (_, i) => ({ day: addDays(start, i), value: value(addDays(start, i)) })) };
	}
	const first = start && start <= today && weekStart(start) > twelveWeeksAgo ? weekStart(start) : twelveWeeksAgo;
	const weeks = Math.round(span(first, thisWeek) / 7) + 1;
	return {
		period: "week",
		points: Array.from({ length: weeks }, (_, i) => {
			const week = addDays(first, 7 * i);
			const end = addDays(week, 6);
			return { day: week, value: daily.filter((d) => d.day >= week && d.day <= end).reduce((t, d) => t + d.value, 0) };
		}),
	};
}
