/**
 * A project's status, the same on the public page and in the admin: a dot, always with its word
 * (never colour alone).
 * - Live: green, pulsing like Tech Jobs' live dot while its latest uptime check is up (still for
 *   reduced motion, and still green before its first check); "Down" with a still grey dot when the
 *   latest check failed.
 * - Building: still amber. Paused, Idea, Retired: still grey.
 */
const STATUS: Record<string, { label: string; dot: string }> = {
	live: { label: "Live", dot: "var(--good)" },
	building: { label: "Building", dot: "var(--warning)" },
	paused: { label: "Paused", dot: "var(--muted)" },
	idea: { label: "Idea", dot: "var(--muted)" },
	retired: { label: "Retired", dot: "var(--muted)" },
};

/** `up`: the project's latest uptime check (true up, false down, null when there's no recent check). */
export function StatusDot({ status, up = null }: { status: string; up?: boolean | null }) {
	const s = STATUS[status];
	if (!s) return null;
	const down = status === "live" && up === false;
	const pulse = status === "live" && up === true;
	return (
		<span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-ink-2">
			<span aria-hidden className={`h-2 w-2 rounded-full ${pulse ? "animate-live motion-reduce:animate-none" : ""}`} style={{ background: down ? "var(--muted)" : s.dot }} />
			{down ? "Down" : s.label}
		</span>
	);
}
