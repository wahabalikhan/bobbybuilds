"use client";

/**
 * The admin Home's interactive pieces: the project dropdown, the monthly bars and the card
 * sparklines, each with the ink hover card every chart uses (HOVER_CARD). They only
 * show figures already in the page, so they make no requests. Every chart also has a
 * screen-reader-only table with the same numbers.
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { ProjectLogo } from "@/components/admin/ui";
import { niceTicks } from "@/lib/scale";
import { HOVER_CARD, HOVER_LABEL } from "@/lib/chart-style";
import { formatDay, formatWhole } from "@/lib/format";

export type ChartProject = { slug: string; name: string; logoPath: string | null };

/** Width of an element, following resizes (the SVGs are drawn at their real size, so text stays crisp). */
function useWidth<T extends HTMLElement>(initial: number) {
	const ref = useRef<T>(null);
	const [width, setWidth] = useState(initial);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
		observer.observe(el);
		return () => observer.disconnect();
	}, []);
	return [ref, width] as const;
}

/** The floating card. `x` is the anchor's position across the chart (0–1); it opens on the roomier side. */
export function Popover({ x, top = 0, children }: { x: number; top?: number; children: ReactNode }) {
	const style: CSSProperties = x <= 0.5 ? { left: `calc(${x * 100}% + 14px)`, top } : { right: `calc(${(1 - x) * 100}% + 14px)`, top };
	return (
		<div aria-hidden className={`absolute ${HOVER_CARD} min-w-[200px] text-sm`} style={style}>
			{children}
		</div>
	);
}

export function PopoverRow({ project, value }: { project: ChartProject; value: string }) {
	return (
		<div className="mt-1.5 flex items-center justify-between gap-6">
			<span className="flex min-w-0 items-center gap-2 opacity-80">
				<ProjectLogo name={project.name} logoPath={project.logoPath} size={18} />
				<span className="truncate">{project.name}</span>
			</span>
			<span className="whitespace-nowrap tabular font-semibold">{value}</span>
		</div>
	);
}

function Check() {
	return (
		<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className="shrink-0">
			<path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

/**
 * A custom dropdown (listbox) for choosing a project: logo and name per option, a tick on the
 * chosen one. Keyboard: Enter/Space/↓ opens, ↑↓ Home End move, Enter picks, Esc closes.
 */
export function ProjectSelect({
	projects,
	value,
	onChange,
	allLabel,
	label,
}: {
	projects: ChartProject[];
	value: string;
	onChange: (slug: string) => void;
	allLabel: string;
	label: string;
}) {
	const id = useId();
	const [open, setOpen] = useState(false);
	const options = [{ slug: "", name: allLabel, logoPath: null as string | null }, ...projects];
	const selected = Math.max(0, options.findIndex((o) => o.slug === value));
	const [active, setActive] = useState(selected);
	const root = useRef<HTMLDivElement>(null);
	const list = useRef<HTMLUListElement>(null);
	const button = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!open) return;
		list.current?.focus();
		const away = (event: PointerEvent) => {
			if (!root.current?.contains(event.target as Node)) setOpen(false);
		};
		document.addEventListener("pointerdown", away);
		return () => document.removeEventListener("pointerdown", away);
	}, [open]);

	const show = () => {
		setActive(selected);
		setOpen(true);
	};
	const pick = (index: number) => {
		onChange(options[index].slug);
		setOpen(false);
		button.current?.focus();
	};
	const onButtonKey = (event: KeyboardEvent) => {
		if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
			event.preventDefault();
			show();
		}
	};
	const onListKey = (event: KeyboardEvent) => {
		const moves: Record<string, number> = { ArrowDown: active + 1, ArrowUp: active - 1, Home: 0, End: options.length - 1 };
		if (event.key in moves) {
			event.preventDefault();
			setActive(Math.min(options.length - 1, Math.max(0, moves[event.key])));
		} else if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			pick(active);
		} else if (event.key === "Escape" || event.key === "Tab") {
			setOpen(false);
			if (event.key === "Escape") button.current?.focus();
		}
	};

	return (
		<div ref={root} className="relative">
			<button
				ref={button}
				type="button"
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-label={`${label}: ${options[selected].name}`}
				onClick={() => (open ? setOpen(false) : show())}
				onKeyDown={onButtonKey}
				className="inline-flex items-center gap-2 rounded-full border border-line bg-card py-1.5 pl-3.5 pr-3 text-sm text-ink hover:bg-pill"
			>
				{options[selected].slug && <ProjectLogo name={options[selected].name} logoPath={options[selected].logoPath} size={16} />}
				{options[selected].name}
				<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}>
					<path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			</button>
			{open && (
				<ul
					ref={list}
					role="listbox"
					tabIndex={-1}
					aria-label={label}
					aria-activedescendant={`${id}-${active}`}
					onKeyDown={onListKey}
					className="absolute right-0 z-30 mt-1.5 max-h-[60vh] min-w-[220px] overflow-auto rounded-2xl border border-line bg-card p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] outline-none"
				>
					{options.map((option, index) => (
						<li
							key={option.slug || "all"}
							id={`${id}-${index}`}
							role="option"
							aria-selected={index === selected}
							onPointerEnter={() => setActive(index)}
							onClick={() => pick(index)}
							className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-[15px] text-ink ${index === active ? "bg-pill" : ""}`}
						>
							{option.slug ? <ProjectLogo name={option.name} logoPath={option.logoPath} size={20} /> : null}
							<span className="flex-1 truncate">{option.name}</span>
							{index === selected && <Check />}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

/** A table only screen readers see, with the same numbers as the chart next to it. */
export function ScreenReaderTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
	return (
		<table className="sr-only">
			<caption>{caption}</caption>
			<thead>
				<tr>
					{head.map((h) => (
						<th key={h} scope="col">
							{h}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{rows.map((row) => (
					<tr key={String(row[0])}>
						{row.map((cell, i) => (i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>))}
					</tr>
				))}
			</tbody>
		</table>
	);
}

const PAD = { top: 14, right: 8, bottom: 26, left: 44 };

/**
 * Visitors per month as dark columns (this month so far is lighter). Hovering or moving
 * through the months with the arrow keys opens a popover with each project's visitors and the
 * total; with one project chosen, just that project.
 */
export function MonthBars({
	months,
	projects,
	title,
	height = 220,
}: {
	/** Labels, e.g. "Nov 2025" … "Oct 2026"; the last month is in progress. */
	months: string[];
	/** Each project's visitors per month, in the same order as `months`. */
	projects: (ChartProject & { values: number[] })[];
	title: string;
	height?: number;
}) {
	const [box, width] = useWidth<HTMLDivElement>(720);
	const [hover, setHover] = useState<number | null>(null);
	const totals = months.map((_, i) => projects.reduce((t, p) => t + (p.values[i] ?? 0), 0));
	const ticks = niceTicks(Math.max(0, ...totals));
	const yMax = ticks[ticks.length - 1] || 1;
	const plotW = width - PAD.left - PAD.right;
	const plotH = height - PAD.top - PAD.bottom;
	const band = plotW / Math.max(1, months.length);
	const barW = Math.min(28, band * 0.62);
	const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;
	const every = Math.ceil(months.length / (width < 480 ? 6 : 12));
	const last = months.length - 1;

	const onKey = (event: KeyboardEvent) => {
		if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
			event.preventDefault();
			setHover((h) => Math.min(last, Math.max(0, (h ?? (event.key === "ArrowRight" ? -1 : last + 1)) + (event.key === "ArrowRight" ? 1 : -1))));
		} else if (event.key === "Escape") setHover(null);
	};

	const shown = hover === null ? [] : projects.filter((p) => projects.length === 1 || (p.values[hover] ?? 0) > 0);

	return (
		<div ref={box} className="relative" onMouseLeave={() => setHover(null)}>
			<svg
				viewBox={`0 0 ${width} ${height}`}
				width={width}
				height={height}
				className="block h-auto w-full outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
				tabIndex={0}
				role="img"
				aria-label={`${title}. Use the left and right arrow keys to read each month.`}
				onKeyDown={onKey}
				onBlur={() => setHover(null)}
			>
				{ticks.map((t) => (
					<g key={t}>
						<line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--axis)" : "var(--grid)"} strokeDasharray={t === 0 ? undefined : "3 3"} />
						<text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular">
							{formatWhole(t)}
						</text>
					</g>
				))}
				{months.map((month, i) => {
					const cx = PAD.left + band * i + band / 2;
					const h = Math.max(0, y(0) - y(totals[i]));
					const r = Math.min(5, h, barW / 2);
					const top = y(totals[i]);
					const left = cx - barW / 2;
					const d = h <= 0 ? "" : `M${left},${y(0)}V${top + r}Q${left},${top} ${left + r},${top}H${left + barW - r}Q${left + barW},${top} ${left + barW},${top + r}V${y(0)}Z`;
					return (
						<g key={month}>
							{hover === i && <rect x={cx - band / 2 + 2} y={PAD.top} width={band - 4} height={plotH} rx={10} fill="var(--pill)" />}
							<path d={d} fill={i === last ? "var(--chart-soft)" : "var(--chart-bar)"} />
							{i % every === 0 && (
								<text x={cx} y={height - 6} fontSize={11} fill="var(--muted)" textAnchor="middle">
									{month.slice(0, 3)}
								</text>
							)}
							<rect x={cx - band / 2} y={PAD.top} width={band} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
						</g>
					);
				})}
			</svg>
			{hover !== null && (
				<Popover x={(PAD.left + band * hover + band / 2) / width} top={PAD.top}>
					<div className={HOVER_LABEL}>
						{months[hover]}
						{hover === last && ", so far"}
					</div>
					{shown.map((p) => (
						<PopoverRow key={p.slug} project={p} value={formatWhole(p.values[hover] ?? 0)} />
					))}
					{shown.length === 0 && <div className="mt-1.5 opacity-80">No visitors</div>}
					{projects.length > 1 && (
						<div className="mt-2.5 flex items-center justify-between border-t border-[color-mix(in_srgb,var(--page)_20%,transparent)] pt-2.5">
							<span className="text-[11px] font-medium uppercase tracking-[0.06em] opacity-70">Total</span>
							<span className="tabular font-semibold">{formatWhole(totals[hover])}</span>
						</div>
					)}
				</Popover>
			)}
			<p className="sr-only" aria-live="polite">
				{hover !== null ? `${months[hover]}: ${formatWhole(totals[hover])} visitors` : ""}
			</p>
			<ScreenReaderTable
				caption={title}
				head={["Month", ...(projects.length > 1 ? projects.map((p) => p.name) : []), "Visitors"]}
				rows={months.map((m, i) => [m, ...(projects.length > 1 ? projects.map((p) => formatWhole(p.values[i] ?? 0)) : []), formatWhole(totals[i])])}
			/>
		</div>
	);
}

/**
 * The project card's 12-week trend (light fill, dark line, this week dashed). Hovering shows a
 * dot and a line on the nearest week, and a popover with that week's visitors.
 */
export function WeekSparkline({ project, weeks, label, height = 56 }: { project: ChartProject; weeks: { day: string; value: number }[]; label: string; height?: number }) {
	const [box, width] = useWidth<HTMLDivElement>(300);
	const [hover, setHover] = useState<number | null>(null);
	const values = weeks.map((w) => w.value);
	const max = Math.max(1, ...values);
	const n = values.length;
	const x = (i: number) => (n <= 1 ? width / 2 : 4 + (i / (n - 1)) * (width - 8));
	const y = (v: number) => height - 2 - (v / max) * (height - 10);
	const line = (from: number, to: number) => values.slice(from, to).map((v, i) => `${i ? "L" : "M"}${x(from + i).toFixed(1)},${y(v).toFixed(1)}`).join("");
	const solidEnd = n >= 2 ? n - 1 : n;
	const area = n > 1 ? `${line(0, n)}L${x(n - 1)},${height}L${x(0)},${height}Z` : "";

	const onMove = (event: React.PointerEvent) => {
		const rect = event.currentTarget.getBoundingClientRect();
		const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
		setHover(Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1)))));
	};

	return (
		<div ref={box} className="relative" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
			<svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block h-auto w-full" role="img" aria-label={label}>
				<path d={area} fill="var(--chart-fill)" />
				<path d={line(0, solidEnd)} fill="none" stroke="var(--chart-line)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
				{solidEnd < n && <path d={line(n - 2, n)} fill="none" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 4" />}
				{hover !== null && (
					<>
						<line x1={x(hover)} x2={x(hover)} y1={0} y2={height} stroke="var(--axis)" />
						<circle cx={x(hover)} cy={y(values[hover])} r={4.5} fill="var(--chart-bar)" stroke="var(--card)" strokeWidth={2} />
					</>
				)}
			</svg>
			{hover !== null && (
				<Popover x={x(hover) / width} top={-12}>
					<div className={HOVER_LABEL}>
						Week of {formatDay(weeks[hover].day, true)}
						{hover === n - 1 && ", so far"}
					</div>
					<PopoverRow project={project} value={`${formatWhole(values[hover])} visitor${values[hover] === 1 ? "" : "s"}`} />
				</Popover>
			)}
		</div>
	);
}
