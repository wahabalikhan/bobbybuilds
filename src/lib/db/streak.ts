import { addDays } from "@/lib/days";

export type WeekCommits = { week: string; commits: number };

/**
 * Shipping streak: consecutive Monday-start weeks with at least one commit.
 * The current week counts once it has a commit; until then the streak runs to last week,
 * so Monday morning doesn't break it. Weeks with no row count as zero.
 */
export function shippingStreak(weeks: WeekCommits[], thisWeek: string): { current: number; longest: number } {
	const commits = new Map(weeks.map((w) => [w.week, w.commits]));
	const has = (week: string) => (commits.get(week) ?? 0) > 0;

	let current = 0;
	let week = has(thisWeek) ? thisWeek : addDays(thisWeek, -7);
	while (has(week)) {
		current += 1;
		week = addDays(week, -7);
	}

	let longest = 0;
	let run = 0;
	const sorted = [...weeks].sort((a, b) => a.week.localeCompare(b.week));
	let previous: string | null = null;
	for (const w of sorted) {
		if (w.commits > 0) {
			run = previous !== null && addDays(previous, 7) === w.week && run > 0 ? run + 1 : 1;
			longest = Math.max(longest, run);
		} else {
			run = 0;
		}
		previous = w.week;
	}
	return { current, longest: Math.max(longest, current) };
}

/** The last `count` weeks ending with `thisWeek`, filled with zeros where there's no row. */
export function lastWeeks(weeks: WeekCommits[], thisWeek: string, count: number): WeekCommits[] {
	const commits = new Map(weeks.map((w) => [w.week, w.commits]));
	return Array.from({ length: count }, (_, i) => {
		const week = addDays(thisWeek, -7 * (count - 1 - i));
		return { week, commits: commits.get(week) ?? 0 };
	});
}
