/**
 * Shared UI pieces for every page: white cards with thin borders and 16px corners, small grey
 * pills for numbers, black pill buttons, quiet section headings with a hairline underneath.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { RANGE_PRESETS, type DateRange } from "@/lib/admin/range";
import { formatChange } from "@/lib/format";

export const buttonClass = "inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-page hover:opacity-85";
export const quietButtonClass = "inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3.5 py-1.5 text-sm text-ink hover:bg-pill";

export function Card({ title, note, children, className = "", action }: { title?: string; note?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
	return (
		<section className={`rounded-2xl border border-line bg-card p-5 ${className}`}>
			{(title || action) && (
				<header className="mb-4 flex items-start justify-between gap-3">
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

/** "My projects ………… 3": a small heading, a hairline, and something on the right. */
export function SectionHeading({ id, children, aside, relaxed = false }: { id?: string; children: ReactNode; aside?: ReactNode; relaxed?: boolean }) {
	return (
		<div className={`flex items-baseline justify-between gap-3 border-b border-line ${relaxed ? "mb-6 pb-3.5" : "mb-4 pb-2"}`}>
			<h2 id={id} className="text-[15px] font-medium tracking-tight">
				{children}
			</h2>
			{aside && <div className="text-sm text-muted">{aside}</div>}
		</div>
	);
}

/** "Home / Tech Jobs": where this page sits. The last item is the current page. */
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
	return (
		<nav aria-label="Breadcrumb" className="text-sm text-muted">
			<ol className="flex flex-wrap items-center gap-1.5">
				{items.map((item, i) => (
					<li key={i} className="flex items-center gap-1.5">
						{i > 0 && <span aria-hidden>/</span>}
						{item.href ? (
							<Link href={item.href} className="hover:text-ink">
								{item.label}
							</Link>
						) : (
							<span aria-current="page" className="text-ink">
								{item.label}
							</span>
						)}
					</li>
				))}
			</ol>
		</nav>
	);
}

/** A small rounded number badge, e.g. "2,731 visitors". */
export function Pill({ children, title }: { children: ReactNode; title?: string }) {
	return (
		<span title={title} className="inline-flex shrink-0 items-center rounded-full bg-pill px-2 py-0.5 text-xs font-semibold tabular text-ink">
			{children}
		</span>
	);
}

/** Up is good for every number here, so a rise reads green and a fall red (always with an arrow). */
export function Delta({ value, period }: { value: number | null; period?: string }) {
	const tone = value === null || value === 0 ? "text-muted" : value > 0 ? "text-good-ink" : "text-critical";
	const arrow = value === null || value === 0 ? "" : value > 0 ? "↑ " : "↓ ";
	return (
		<span className={`text-sm ${tone}`}>
			{arrow}
			{formatChange(value)}
			{period && <span className="text-muted"> vs {period}</span>}
		</span>
	);
}

export function StatTile({ label, value, delta, hint }: { label: string; value: string; delta?: ReactNode; hint?: ReactNode }) {
	return (
		<div className="rounded-2xl border border-line bg-card p-4">
			<p className="text-sm text-muted">{label}</p>
			<p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
			{delta && <div className="mt-1">{delta}</div>}
			{hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
		</div>
	);
}

export function Tabs({ tabs, current, hrefFor }: { tabs: { key: string; label: string }[]; current: string; hrefFor: (key: string) => string }) {
	return (
		<nav aria-label="Sections" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
			{tabs.map((tab) => {
				const active = tab.key === current;
				return (
					<Link
						key={tab.key}
						href={hrefFor(tab.key)}
						aria-current={active ? "page" : undefined}
						className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm ${active ? "bg-ink font-medium text-page" : "text-ink-2 hover:bg-pill hover:text-ink"}`}
					>
						{tab.label}
					</Link>
				);
			})}
		</nav>
	);
}

/** Preset range pills plus a custom range form (plain GET, no JavaScript needed). */
export function RangePicker({ range, hrefFor, hidden = {} }: { range: DateRange; hrefFor: (params: Record<string, string>) => string; hidden?: Record<string, string> }) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<div className="flex rounded-full border border-line bg-card p-0.5">
				{Object.entries(RANGE_PRESETS).map(([key, preset]) => (
					<Link
						key={key}
						href={hrefFor({ range: key })}
						aria-current={range.key === key ? "true" : undefined}
						className={`rounded-full px-3 py-1 text-sm ${range.key === key ? "bg-ink font-medium text-page" : "text-ink-2 hover:text-ink"}`}
					>
						{preset.label.replace("Last ", "")}
					</Link>
				))}
			</div>
			<form method="get" className="flex items-center gap-1 text-sm">
				{Object.entries(hidden).map(([name, value]) => (
					<input key={name} type="hidden" name={name} value={value} />
				))}
				<input type="hidden" name="range" value="custom" />
				<label className="sr-only" htmlFor="range-from">From</label>
				<input id="range-from" type="date" name="from" defaultValue={range.from} className="rounded-full border border-line bg-card px-3 py-1" />
				<span className="text-muted">to</span>
				<label className="sr-only" htmlFor="range-to">To</label>
				<input id="range-to" type="date" name="to" defaultValue={range.to} className="rounded-full border border-line bg-card px-3 py-1" />
				<button className={quietButtonClass}>Apply</button>
			</form>
		</div>
	);
}

export function Empty({ children }: { children: ReactNode }) {
	return <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">{children}</p>;
}

export function RawNote({ clipped }: { clipped: boolean }) {
	return <>From raw data, kept for 90 days{clipped ? ", so this covers the last 90 days of your range" : ""}.</>;
}

const STATUS = {
	live: { label: "Live", dot: "var(--good)" },
	building: { label: "Building", dot: "var(--warning)" },
	idea: { label: "Idea", dot: "var(--muted)" },
	retired: { label: "Retired", dot: "var(--muted)" },
} as const;

/** Live / Building / Idea / Retired: a small pill with a dot and the word (never colour alone). */
export function StatusPill({ status }: { status: string }) {
	const s = STATUS[status as keyof typeof STATUS] ?? STATUS.idea;
	return (
		<span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs text-ink-2">
			<span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
			{s.label}
		</span>
	);
}

/** The project's logo from public/logos, or its first letter on a dark rounded square. */
export function ProjectLogo({ name, logoPath, size = 28 }: { name: string; logoPath: string | null; size?: number }) {
	if (logoPath) {
		// A hairline ring keeps dark logos visible on dark backgrounds (and light ones on white).
		// eslint-disable-next-line @next/next/no-img-element -- small local logos; next/image adds nothing here
		return <img src={logoPath} alt="" width={size} height={size} className="shrink-0 rounded-lg object-cover ring-1 ring-line" style={{ width: size, height: size }} />;
	}
	return (
		<span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-lg bg-ink font-semibold text-page" style={{ width: size, height: size, fontSize: size * 0.48 }}>
			{name.slice(0, 1).toUpperCase()}
		</span>
	);
}
