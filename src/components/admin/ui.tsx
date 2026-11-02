import Link from "next/link";
import type { ReactNode } from "react";
import { RANGE_PRESETS, type DateRange } from "@/lib/admin/range";
import { formatChange } from "@/lib/format";

export function Card({ title, note, children, className = "", action }: { title?: string; note?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
	return (
		<section className={`rounded-2xl border border-line bg-card p-5 ${className}`}>
			{(title || action) && (
				<header className="mb-3 flex items-start justify-between gap-3">
					<div>
						{title && <h2 className="font-semibold tracking-tight">{title}</h2>}
						{note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
					</div>
					{action}
				</header>
			)}
			{children}
		</section>
	);
}

/** Up is good for every number on this dashboard, so a rise reads green and a fall red. */
export function Delta({ value, period }: { value: number | null; period: string }) {
	const tone = value === null || value === 0 ? "text-muted" : value > 0 ? "text-good-ink" : "text-critical";
	const arrow = value === null || value === 0 ? "" : value > 0 ? "↑ " : "↓ ";
	return (
		<span className={`text-sm ${tone}`}>
			{arrow}
			{formatChange(value)} <span className="text-muted">vs {period}</span>
		</span>
	);
}

export function StatTile({ label, value, delta, hint }: { label: string; value: string; delta?: ReactNode; hint?: ReactNode }) {
	return (
		<div className="rounded-2xl border border-line bg-card p-4">
			<p className="text-sm text-ink-2">{label}</p>
			<p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
			{delta && <p className="mt-1">{delta}</p>}
			{hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
		</div>
	);
}

export function Tabs({ tabs, current, hrefFor }: { tabs: { key: string; label: string }[]; current: string; hrefFor: (key: string) => string }) {
	return (
		<nav aria-label="Sections" className="-mx-1 flex gap-1 overflow-x-auto border-b border-line pb-px">
			{tabs.map((tab) => {
				const active = tab.key === current;
				return (
					<Link
						key={tab.key}
						href={hrefFor(tab.key)}
						aria-current={active ? "page" : undefined}
						className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-sm ${active ? "border-b-2 border-accent font-medium text-ink" : "text-ink-2 hover:text-ink"}`}
					>
						{tab.label}
					</Link>
				);
			})}
		</nav>
	);
}

/** Preset range links plus a custom range form (plain GET, no JavaScript needed). */
export function RangePicker({ range, hrefFor, hidden = {} }: { range: DateRange; hrefFor: (params: Record<string, string>) => string; hidden?: Record<string, string> }) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			{Object.entries(RANGE_PRESETS).map(([key, preset]) => (
				<Link
					key={key}
					href={hrefFor({ range: key })}
					aria-current={range.key === key ? "true" : undefined}
					className={`rounded-full border px-3 py-1 text-sm ${range.key === key ? "border-accent bg-[var(--accent-wash)] font-medium" : "border-line text-ink-2 hover:text-ink"}`}
				>
					{preset.label.replace("Last ", "")}
				</Link>
			))}
			<form method="get" className="flex items-center gap-1 text-sm">
				{Object.entries(hidden).map(([name, value]) => (
					<input key={name} type="hidden" name={name} value={value} />
				))}
				<input type="hidden" name="range" value="custom" />
				<label className="sr-only" htmlFor="range-from">From</label>
				<input id="range-from" type="date" name="from" defaultValue={range.from} className="rounded-lg border border-line bg-card px-2 py-1" />
				<span className="text-muted">to</span>
				<label className="sr-only" htmlFor="range-to">To</label>
				<input id="range-to" type="date" name="to" defaultValue={range.to} className="rounded-lg border border-line bg-card px-2 py-1" />
				<button className="rounded-lg border border-line px-2 py-1 hover:bg-[var(--accent-wash)]">Apply</button>
			</form>
		</div>
	);
}

export function Empty({ children }: { children: ReactNode }) {
	return <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{children}</p>;
}

export function RawNote({ clipped }: { clipped: boolean }) {
	return (
		<>
			From raw data, kept for 90 days{clipped ? ", so this covers the last 90 days of your range" : ""}.
		</>
	);
}

export function StatusPill({ status }: { status: string }) {
	const label = status === "live" ? "Live" : status === "building" ? "Building" : status === "idea" ? "Idea" : "Retired";
	return <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-2">{label}</span>;
}
