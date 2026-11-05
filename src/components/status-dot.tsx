/**
 * A project's status, the same on the public page and in the admin: a coloured dot, always with its
 * word (never colour alone). Live is green, Building amber, the others grey.
 */
const STATUS: Record<string, { label: string; dot: string }> = {
	live: { label: "Live", dot: "var(--good)" },
	building: { label: "Building", dot: "var(--warning)" },
	paused: { label: "Paused", dot: "var(--muted)" },
	idea: { label: "Idea", dot: "var(--muted)" },
	retired: { label: "Retired", dot: "var(--muted)" },
};

export function StatusDot({ status }: { status: string }) {
	const s = STATUS[status];
	if (!s) return null;
	return (
		<span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-ink-2">
			<span aria-hidden className="h-2 w-2 rounded-full" style={{ background: s.dot }} />
			{s.label}
		</span>
	);
}
