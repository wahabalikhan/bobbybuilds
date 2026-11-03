/** Day maths. Every day in BobbyBuilds is a UTC calendar day, written 'YYYY-MM-DD'. */

const DAY_MS = 86_400_000;

export function utcDay(timestampMs: number = Date.now()): string {
	return new Date(timestampMs).toISOString().slice(0, 10);
}

export function isDay(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(value) && utcDay(Date.parse(`${value}T00:00:00Z`)) === value;
}

export function addDays(day: string, days: number): string {
	return utcDay(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS);
}

/** The Monday that starts the week containing `day`. */
export function weekStart(day: string): string {
	const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
	return addDays(day, -((weekday + 6) % 7));
}
