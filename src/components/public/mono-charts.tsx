"use client";

/**
 * The public page's charts: the accent blue for the line or bars, grey axes, gridlines and
 * labels, and one hover card design (HoverCard: an inverted ink card with a small label, a bold
 * value and an optional list). They only show figures already in the page, so they make no
 * requests, and each has a screen-reader-only version of its numbers. The admin keeps its own
 * charts (src/components/public/charts.tsx and src/components/charts.tsx).
 */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { niceTicks } from "@/components/charts";
import { HOVER_CARD, HOVER_LABEL, HOVER_VALUE } from "@/lib/chart-style";
import { formatDay, formatMonth, formatWhole } from "@/lib/format";

/** Width of an element, following resizes (the SVGs are drawn at their real size, so text stays crisp). */
function useWidth<T extends HTMLElement>(initial: number) {
	const ref = useRef<T>(null);
	const [width, setWidth] = useState(initial);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.round(entry.contentRect.width))));
		observer.observe(el);
		return () => observer.disconnect();
	}, []);
	return [ref, width] as const;
}

/**
 * The hover card: ink background (light ink in dark mode), page-coloured text. `x` is the anchor's
 * position across its chart (0–1): the card opens on the roomier side. `top` is from the chart's top.
 */
export function HoverCard({ x, top, label, value, children }: { x: number; top: number; label: string; value: ReactNode; children?: ReactNode }) {
	const style: CSSProperties = x <= 0.5 ? { left: `calc(${x * 100}% + 12px)`, top } : { right: `calc(${(1 - x) * 100}% + 12px)`, top };
	return (
		<div aria-hidden className={`absolute ${HOVER_CARD}`} style={style}>
			<div className={HOVER_LABEL}>{label}</div>
			<div className={HOVER_VALUE}>{value}</div>
			{children}
		</div>
	);
}

/** A short list inside the hover card (what shipped). */
function HoverList({ items }: { items: string[] }) {
	return (
		<ul className="mt-2 space-y-1 border-t border-[color-mix(in_srgb,var(--page)_20%,transparent)] pt-2 text-[13px] leading-snug">
			{items.slice(0, 6).map((item, i) => (
				<li key={i} className="flex gap-1.5">
					<span aria-hidden className="opacity-60">
						–
					</span>
					<span>{item}</span>
				</li>
			))}
			{items.length > 6 && <li className="opacity-70">and {items.length - 6} more</li>}
		</ul>
	);
}

/**
 * A project card's 12-week visitors: a light grey area under an ink line, a grey baseline with the
 * first and last weeks labelled, and this week (not over yet) dashed. Hovering, or the arrow keys
 * when it's focused, shows that week in the hover card.
 */
export function WeekChart({
	weeks,
	label,
	height = 64,
	period = "week",
	unit = ["visitor", "visitors"],
	unfinishedLast = true,
	minPoints = 0,
}: {
	weeks: { day: string; value: number }[];
	label: string;
	height?: number;
	period?: "week" | "day";
	unit?: [string, string];
	/** The last point is a period still in progress: its segment is dashed and it says "so far". */
	unfinishedLast?: boolean;
	/** Space for at least this many points, so a short series (a new project) isn't stretched across the chart: it starts at the left and stops where its data does. */
	minPoints?: number;
}) {
	const pointName = (day: string, long = false) => (period === "week" ? `Week of ${formatDay(day, long)}` : formatDay(day, long));
	const lastName = period === "week" ? "This week" : "Today";
	const [box, width] = useWidth<HTMLDivElement>(300);
	const [hover, setHover] = useState<number | null>(null);
	const values = weeks.map((w) => w.value);
	const n = values.length;
	const max = Math.max(1, ...values);
	const plotH = height - 18;
	const slots = Math.max(n, minPoints);
	const x = (i: number) => (slots <= 1 ? width / 2 : 4 + (i / (slots - 1)) * (width - 8));
	const y = (v: number) => plotH - (v / max) * (plotH - 8);
	const line = (from: number, to: number) => values.slice(from, to).map((v, i) => `${i ? "L" : "M"}${x(from + i).toFixed(1)},${y(v).toFixed(1)}`).join("");
	const solidEnd = unfinishedLast && n >= 2 ? n - 1 : n;
	const area = n > 1 ? `${line(0, n)}L${x(n - 1)},${plotH}L${x(0)},${plotH}Z` : "";

	const onMove = (event: React.PointerEvent) => {
		const rect = event.currentTarget.getBoundingClientRect();
		setHover(Math.min(n - 1, Math.max(0, Math.round(((event.clientX - rect.left) / Math.max(1, rect.width)) * (slots - 1)))));
	};
	const onKey = (event: KeyboardEvent) => {
		if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
			event.preventDefault();
			const step = event.key === "ArrowRight" ? 1 : -1;
			setHover((h) => Math.min(n - 1, Math.max(0, h === null ? (step > 0 ? 0 : n - 1) : h + step)));
		} else if (event.key === "Escape") setHover(null);
	};

	return (
		<div ref={box} className="relative" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
			<svg
				viewBox={`0 0 ${width} ${height}`}
				width={width}
				height={height}
				className="block h-auto w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
				role="img"
				tabIndex={0}
				aria-label={`${label} Use the left and right arrow keys to read each ${period}.`}
				onKeyDown={onKey}
				onBlur={() => setHover(null)}
			>
				<path d={area} fill="var(--chart-fill)" />
				<line x1={0} x2={width} y1={plotH + 0.5} y2={plotH + 0.5} stroke="var(--axis)" />
				<path d={line(0, solidEnd)} fill="none" stroke="var(--accent)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
				{solidEnd < n && <path d={line(n - 2, n)} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="3 3" strokeLinecap="round" />}
				<text x={0} y={height - 3} fontSize={11} fill="var(--muted)">
					{n ? formatDay(weeks[0].day) : ""}
				</text>
				{/* The last label sits under the last point (the chart's right edge unless it's a short series). */}
				<text x={n > 0 && x(n - 1) > width * 0.6 ? width : n > 0 ? x(n - 1) : width} y={height - 3} fontSize={11} fill="var(--muted)" textAnchor={n > 0 && x(n - 1) > width * 0.6 ? "end" : "start"}>
					{n > 1 || slots === n ? (unfinishedLast ? lastName : n ? formatDay(weeks[n - 1].day) : "") : ""}
				</text>
				{hover !== null && (
					<>
						<line x1={x(hover)} x2={x(hover)} y1={0} y2={plotH} stroke="var(--axis)" strokeDasharray="2 2" />
						<circle cx={x(hover)} cy={y(values[hover])} r={4} fill="var(--accent)" stroke="var(--card)" strokeWidth={2} />
					</>
				)}
			</svg>
			{hover !== null && (
				<HoverCard x={x(hover) / width} top={-8} label={`${pointName(weeks[hover].day)}${unfinishedLast && hover === n - 1 ? ", so far" : ""}`} value={`${formatWhole(values[hover])} ${values[hover] === 1 ? unit[0] : unit[1]}`} />
			)}
			<p className="sr-only" aria-live="polite">
				{hover !== null ? `${pointName(weeks[hover].day, true)}: ${formatWhole(values[hover])} ${unit[1]}` : ""}
			</p>
		</div>
	);
}

const PAD = { top: 12, right: 4, bottom: 24, left: 28 };

/**
 * Monthly counts as ink columns (this month, not over yet, is lighter), with grey gridlines and
 * labels, in the style of the old 12-month visitors chart. Hovering, or the arrow keys, shows the
 * month in the hover card with its list (e.g. what shipped).
 */
export function MonthBars({ months, title, unit, height = 200 }: { months: { month: string; value: number; items: string[] }[]; title: string; unit: [string, string]; height?: number }) {
	const [box, width] = useWidth<HTMLDivElement>(420);
	const [hover, setHover] = useState<number | null>(null);
	const ticks = niceTicks(Math.max(0, ...months.map((m) => m.value)));
	const yMax = ticks[ticks.length - 1] || 1;
	const plotW = width - PAD.left - PAD.right;
	const plotH = height - PAD.top - PAD.bottom;
	const band = plotW / Math.max(1, months.length);
	const barW = Math.min(22, band * 0.58);
	const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;
	const every = Math.ceil(months.length / (width < 380 ? 4 : 6));
	const last = months.length - 1;
	const count = (v: number) => `${formatWhole(v)} ${v === 1 ? unit[0] : unit[1]}`;

	const onKey = (event: KeyboardEvent) => {
		if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
			event.preventDefault();
			const step = event.key === "ArrowRight" ? 1 : -1;
			setHover((h) => Math.min(last, Math.max(0, h === null ? (step > 0 ? 0 : last) : h + step)));
		} else if (event.key === "Escape") setHover(null);
	};

	return (
		<div ref={box} className="relative" onMouseLeave={() => setHover(null)}>
			<svg
				viewBox={`0 0 ${width} ${height}`}
				width={width}
				height={height}
				className="block h-auto w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
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
				{months.map((m, i) => {
					const cx = PAD.left + band * i + band / 2;
					const h = Math.max(0, y(0) - y(m.value));
					const r = Math.min(4, h, barW / 2);
					const top = y(m.value);
					const left = cx - barW / 2;
					const d = h <= 0 ? "" : `M${left},${y(0)}V${top + r}Q${left},${top} ${left + r},${top}H${left + barW - r}Q${left + barW},${top} ${left + barW},${top + r}V${y(0)}Z`;
					return (
						<g key={m.month}>
							{hover === i && <rect x={cx - band / 2 + 1} y={PAD.top} width={band - 2} height={plotH} rx={8} fill="var(--pill)" />}
							<path d={d} fill={i === last ? "color-mix(in srgb, var(--accent) 40%, var(--card))" : "var(--accent)"} />
							{i % every === 0 && (
								<text x={cx} y={height - 6} fontSize={11} fill="var(--muted)" textAnchor="middle">
									{formatMonth(m.month).slice(0, 3)}
								</text>
							)}
							<rect x={cx - band / 2} y={PAD.top} width={band} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
						</g>
					);
				})}
			</svg>
			{hover !== null && (
				<HoverCard x={(PAD.left + band * hover + band / 2) / width} top={PAD.top} label={`${formatMonth(months[hover].month)}${hover === last ? ", so far" : ""}`} value={count(months[hover].value)}>
					{months[hover].items.length > 0 && <HoverList items={months[hover].items} />}
				</HoverCard>
			)}
			<p className="sr-only" aria-live="polite">
				{hover !== null ? `${formatMonth(months[hover].month)}: ${count(months[hover].value)}${months[hover].items.length ? `: ${months[hover].items.join(", ")}` : ""}` : ""}
			</p>
			<div className="sr-only">
				<table>
					<caption>{title}</caption>
					<thead>
						<tr>
							<th scope="col">Month</th>
							<th scope="col">{unit[1]}</th>
						</tr>
					</thead>
					<tbody>
						{months.map((m) => (
							<tr key={m.month}>
								<th scope="row">{formatMonth(m.month)}</th>
								<td>
									{m.value}
									{m.items.length ? ` (${m.items.join(", ")})` : ""}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

/** GitHub's five levels: none, 1–3, 4–6, 7–9, 10+ (blues, in globals.css: --act-0 … --act-4). */
export function level(count: number): number {
	return count <= 0 ? 0 : count <= 3 ? 1 : count <= 6 ? 2 : count <= 9 ? 3 : 4;
}

const DAY = 86_400_000;
const longDate = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
// "Sep", not en-GB's "Sept".
const shortMonth = (date: Date) => formatMonth(date.toISOString().slice(0, 7)).slice(0, 3);

/** The smallest square, and the gap between squares, in px. */
const MIN_SQUARE = 8;
const GAP = 2;
const LABELS = 28;

/**
 * GitHub contributions as GitHub lays them out (a column per week, Sunday to Saturday), in blues:
 * darker for more (brighter in dark mode). It fills its card: the week columns are equal fractions of the width and the
 * squares stay square. When the full year won't fit with squares of at least MIN_SQUARE, it shows
 * fewer, most recent weeks (and says so). Hovering a square shows that day in the hover card.
 */
export function ContributionGrid({ firstDay, counts }: { firstDay: string; counts: number[] }) {
	const start = Date.parse(`${firstDay}T00:00:00Z`);
	const offset = new Date(start).getUTCDay();
	const allColumns = Math.ceil((offset + counts.length) / 7);
	const [box, width] = useWidth<HTMLDivElement>(440);
	const wrapper = useRef<HTMLDivElement>(null);
	const [hover, setHover] = useState<{ i: number; left: number; top: number; side: number } | null>(null);

	// As many of the latest weeks as fit with squares of at least MIN_SQUARE.
	const columns = Math.max(1, Math.min(allColumns, Math.floor((width - LABELS + GAP) / (MIN_SQUARE + GAP))));
	const firstColumn = allColumns - columns;
	// Day index of the first visible cell (can be negative in the first, partly empty week).
	const firstCell = firstColumn * 7 - offset;
	const lead = Math.max(0, -firstCell);
	const visible = counts.slice(Math.max(0, firstCell)).map((c, j) => ({ c, i: Math.max(0, firstCell) + j }));

	// A month label over the first visible week that starts in that month (never spanning past the last week).
	const months: { col: number; label: string; span: number }[] = [];
	for (let col = 0; col < columns; col++) {
		const first = start + ((firstColumn + col) * 7 - offset) * DAY;
		const day = new Date(Math.max(first, start));
		if (col === 0 ? day.getUTCDate() <= 14 : new Date(first).getUTCDate() <= 7) {
			if (!months.length || col - months[months.length - 1].col >= 3) months.push({ col, label: shortMonth(day), span: Math.min(3, columns - col) });
		}
	}

	const onOver = (event: MouseEvent<HTMLDivElement>) => {
		const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-i]");
		if (!cell || !wrapper.current) return setHover(null);
		const rect = wrapper.current.getBoundingClientRect();
		const square = cell.getBoundingClientRect();
		const left = square.left - rect.left + square.width / 2;
		setHover({ i: Number(cell.dataset.i), left, top: square.top - rect.top, side: left / rect.width });
	};

	const weekColumns = `repeat(${columns}, minmax(0, 1fr))`;
	const count = hover ? counts[hover.i] : 0;
	const shownTotal = visible.reduce((t, v) => t + v.c, 0);

	return (
		<div ref={box}>
			<div ref={wrapper} className="relative" onMouseLeave={() => setHover(null)}>
				<div className="grid text-[11px] text-muted" style={{ gridTemplateColumns: weekColumns, marginLeft: LABELS }} aria-hidden>
					{months.map((m) => (
						<span key={m.col} className="truncate" style={{ gridColumn: `${m.col + 1} / span ${m.span}` }}>
							{m.label}
						</span>
					))}
				</div>
				<div className="mt-1 flex">
					<div className="flex shrink-0 flex-col text-[11px] leading-none text-muted" style={{ width: LABELS, gap: GAP }} aria-hidden>
						{["", "Mon", "", "Wed", "", "Fri", ""].map((day, i) => (
							<span key={i} className="flex flex-1 items-center">
								{day}
							</span>
						))}
					</div>
					<div
						className="grid min-w-0 flex-1"
						style={{ gridTemplateColumns: weekColumns, gridTemplateRows: "repeat(7, auto)", gridAutoFlow: "column", gap: GAP }}
						onMouseOver={onOver}
						role="img"
						aria-label={`${formatWhole(shownTotal)} GitHub contributions in the last ${columns} weeks.`}
					>
						{Array.from({ length: lead }, (_, k) => (
							<span key={`pad-${k}`} />
						))}
						{visible.map(({ c, i }) => (
							<span key={i} data-i={i} className="aspect-square rounded-[2px]" style={{ background: `var(--act-${level(c)})` }} />
						))}
					</div>
				</div>
				{hover && (
					<HoverCard
						x={hover.side}
						top={Math.max(0, hover.top - 64)}
						label={longDate.format(new Date(start + hover.i * DAY))}
						value={`${count === 0 ? "No" : formatWhole(count)} contribution${count === 1 ? "" : "s"}`}
					/>
				)}
			</div>
			<div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted">
				<span>{columns < allColumns ? `Last ${columns} weeks` : "Last 12 months"}</span>
				<span className="flex items-center gap-1.5" aria-hidden>
					Less
					{[0, 1, 2, 3, 4].map((l) => (
						<span key={l} className="h-[10px] w-[10px] rounded-[2px]" style={{ background: `var(--act-${l})` }} />
					))}
					More
				</span>
			</div>
		</div>
	);
}
