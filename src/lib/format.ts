/** Number and date formatting for the dashboard and public pages (UK English, UTC dates). */

const whole = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 });

/** 1,284 under 10,000; 12.9K / 4.2M above. */
export function formatCount(value: number): string {
	// en-GB writes thousands as "k"; the dashboard uses K, as with M.
	return Math.abs(value) < 10_000 ? whole.format(value) : compact.format(value).replace("k", "K");
}

export function formatPercent(value: number | null, digits = 0): string {
	if (value === null || !Number.isFinite(value)) return "–";
	return `${(value * 100).toFixed(digits)}%`;
}

/** Signed change against a previous value, or null when there's nothing to compare with. */
export function change(current: number, previous: number): number | null {
	if (previous === 0) return current === 0 ? 0 : null;
	return (current - previous) / previous;
}

export function formatChange(value: number | null): string {
	if (value === null) return "new";
	const pct = Math.round(value * 100);
	return `${pct > 0 ? "+" : pct < 0 ? "−" : "±"}${Math.abs(pct)}%`;
}

export function formatDuration(ms: number | null): string {
	if (ms === null || !Number.isFinite(ms)) return "–";
	const seconds = Math.round(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export function formatMs(ms: number | null): string {
	if (ms === null || !Number.isFinite(ms)) return "–";
	return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}

/** Axis labels for milliseconds in one unit: seconds when the axis reaches 2 s, otherwise ms. */
export function msAxis(max: number): (ms: number) => string {
	if (max >= 2000) return (ms) => `${(ms / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })} s`;
	return (ms) => `${Math.round(ms)} ms`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2 Nov" (or "2 Nov 2026" with the year). Input is a UTC day 'YYYY-MM-DD'. */
export function formatDay(day: string, withYear = false): string {
	const [year, month, date] = day.split("-").map(Number);
	return `${date} ${MONTHS[month - 1]}${withYear ? ` ${year}` : ""}`;
}

/** "Nov 2026" from 'YYYY-MM'. */
export function formatMonth(month: string): string {
	const [year, m] = month.split("-").map(Number);
	return `${MONTHS[m - 1]} ${year}`;
}

/** "2 Nov, 14:05 UTC" */
export function formatTime(timestampMs: number): string {
	const iso = new Date(timestampMs).toISOString();
	return `${formatDay(iso.slice(0, 10))}, ${iso.slice(11, 16)} UTC`;
}

/** "4 minutes ago" / "3 hours ago" / "2 days ago" */
export function timeAgo(timestampMs: number, now: number = Date.now()): string {
	const minutes = Math.round((now - timestampMs) / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
	const days = Math.round(hours / 24);
	return `${days} days ago`;
}
