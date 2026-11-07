/**
 * Shared UI pieces for every page: white cards with thin borders and 16px corners, small grey
 * pills for numbers, black pill buttons, quiet section headings with a hairline underneath.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { RANGE_PRESETS, type DateRange } from "@/lib/admin/range";
import { formatChange } from "@/lib/format";
import { logoScale } from "@/lib/project-logo";

/**
 * Buttons, after Tech Jobs: one shape (`control`: a 10px rounded square, 44px tall on phones and
 * 40px from 640px). Primary (ink) is for saving; secondary is outlined; icon buttons are square,
 * with a tooltip and an accessible name; danger is outlined red. The styles live in globals.css.
 */
export const buttonClass = "btn-primary control inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium";
/**
 * A segmented control's option (the project tabs, the range presets and "Custom…"), after Tech
 * Jobs: outlined at rest; the chosen one grey (`btn-selected`, never black, which is for primary
 * actions) and in bolder text, so it's clear without relying on colour.
 */
export function chipClass(selected: boolean): string {
	return `control inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 text-sm ${selected ? "btn-selected" : "btn-secondary text-ink-2"}`;
}

/** A square icon button, Tech Jobs' size: 32px (44px on phones, for the tap). Always give it an aria-label and a Tooltip with the same words. */
export const iconButtonClass = "btn-icon rounded-control inline-flex h-11 w-11 shrink-0 items-center justify-center sm:h-8 sm:w-8";

/** "+" for the add buttons (Add a project, Add an entry). */
export function PlusIcon({ className = "h-[18px] w-[18px]" }: { className?: string }) {
	return (
		<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden className={className}>
			<path d="M10 4.5v11M4.5 10h11" />
		</svg>
	);
}

/** A small ink tooltip, centred above its element on hover and keyboard focus. The element keeps its own aria-label. */
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
	return (
		<span className="group/tip relative inline-flex">
			{children}
			<span
				aria-hidden
				className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-page opacity-0 transition-opacity group-hover/tip:opacity-100 group-has-[:focus-visible]/tip:opacity-100 motion-reduce:transition-none"
			>
				{text}
			</span>
		</span>
	);
}

/**
 * Every admin page's title, after Tech Jobs' PageHeader: the h1 (30px bold), an optional subtitle
 * 8px below in body text, and an optional action on the right.
 */
export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-4">
			<div className="min-w-0">
				<h1 className="text-3xl font-bold tracking-tight break-words">{title}</h1>
				{subtitle && <p className="mt-2 text-ink-2">{subtitle}</p>}
			</div>
			{action}
		</div>
	);
}

/** A journey entry's status: a dot and its word, like a project's StatusDot: green "Published", grey "Draft". */
export function EntryStatus({ published }: { published: boolean }) {
	return (
		<span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-ink-2">
			<span aria-hidden className="h-2 w-2 rounded-full" style={{ background: published ? "var(--good)" : "var(--muted)" }} />
			{published ? "Published" : "Draft"}
		</span>
	);
}

/** A status label, a pill (labels are the only pills): green (Published) or grey (Draft). */
export function Badge({ tone, children }: { tone: "success" | "neutral"; children: ReactNode }) {
	return (
		<span className={`inline-flex shrink-0 items-center rounded-full px-2 py-[3px] text-xs font-semibold leading-none ${tone === "success" ? "bg-success-bg text-success" : "bg-pill text-ink-2"}`}>
			{children}
		</span>
	);
}

/** A whole page with nothing in it yet, after Tech Jobs: an icon square, a heading, a line of explanation and the main action. */
export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
	return (
		<section className="rounded-2xl border border-line bg-card px-6 py-8">
			<span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-control bg-pill text-xl">
				{icon}
			</span>
			<h2 className="mt-4 text-xl font-bold tracking-tight">{title}</h2>
			<p className="mt-2 text-ink-2">{children}</p>
			{action && <div className="mt-6">{action}</div>}
		</section>
	);
}

export const quietButtonClass = "btn-secondary control inline-flex items-center justify-center gap-1.5 px-3.5 text-sm";

export function Card({ title, note, children, className = "", action }: { title?: string; note?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
	return (
		// min-w-0: in a grid, wide content (a table, a long URL) scrolls or truncates inside the card instead of widening the page.
		<section className={`min-w-0 rounded-2xl border border-line bg-card p-4 ${className}`}>
			{(title || action) && (
				<header className="mb-4 flex items-start justify-between gap-3">
					<div>
						{title && <h2 className="text-[15px] font-medium tracking-tight">{title}</h2>}
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
export function SectionHeading({ id, children, aside, relaxed = false, divider = true }: { id?: string; children: ReactNode; aside?: ReactNode; relaxed?: boolean; divider?: boolean }) {
	// Without the hairline the heading sits 16px above its content (mb-4), so it still reads as its title.
	return (
		<div className={`flex items-baseline justify-between gap-3 ${divider ? `border-b border-line ${relaxed ? "mb-4 pb-3" : "mb-4 pb-2"}` : "mb-4"}`}>
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
							<Link href={item.href} className="link">
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
	// Nothing to compare with (no earlier period): say nothing, rather than "new".
	if (value === null) return null;
	const tone = value === null || value === 0 ? "text-muted" : value > 0 ? "text-good-ink" : "text-critical-ink";
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
		<nav aria-label="Sections" className="flex gap-2 overflow-x-auto pb-1">
			{tabs.map((tab) => {
				const active = tab.key === current;
				return (
					<Link
						key={tab.key}
						href={hrefFor(tab.key)}
						aria-current={active ? "page" : undefined}
						className={chipClass(active)}
					>
						{tab.label}
					</Link>
				);
			})}
		</nav>
	);
}

/** The range presets (7 days, 30 days, 90 days, 12 months) as a segmented control. No custom dates. */
export function RangePicker({ range, hrefFor }: { range: DateRange; hrefFor: (params: Record<string, string>) => string }) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<div className="flex flex-wrap gap-1.5" role="group" aria-label="Range">
				{Object.entries(RANGE_PRESETS).map(([key, preset]) => (
					<Link
						key={key}
						href={hrefFor({ range: key })}
						aria-current={range.key === key ? "true" : undefined}
						className={chipClass(range.key === key)}
					>
						{preset.label.replace("Last ", "")}
					</Link>
				))}
			</div>
		</div>
	);
}

export function Empty({ children }: { children: ReactNode }) {
	// A plain grey sentence, like the public page's empty states (no dashed box).
	return <p className="text-sm text-muted">{children}</p>;
}

export function RawNote({ clipped }: { clipped: boolean }) {
	return <>From raw data, kept for 90 days{clipped ? ", so this covers the last 90 days of your range" : ""}.</>;
}

/** The project's icon (its stored copy from its own site, else its file in public/logos), or its first letter on a neutral square. */
export function ProjectLogo({ name, logoPath, size = 28 }: { name: string; logoPath: string | null; size?: number }) {
	if (logoPath) {
		// No container: the logo keeps its own shape (a circle, a rounded square…), fitted inside a
		// fixed, invisible box so every logo lines up at the same size. Files are 2× or more, so they stay sharp.
		// Round logos are drawn a little bigger inside that box (logoScale), so they look the same size.
		const scale = logoScale(logoPath);
		// eslint-disable-next-line @next/next/no-img-element -- small local logos; next/image adds nothing here
		return <img src={logoPath} alt="" width={size} height={size} className="block shrink-0 object-contain" style={{ width: size, height: size, ...(scale !== 1 && { transform: `scale(${scale})` }) }} />;
	}
	return (
		// No icon: a neutral placeholder with the first letter, never a broken image.
		<span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-lg border border-line bg-pill font-semibold text-ink-2" style={{ width: size, height: size, fontSize: size * 0.48 }}>
			{name.slice(0, 1).toUpperCase()}
		</span>
	);
}
