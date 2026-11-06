/**
 * Small server-rendered SVG charts. No chart library and no client JavaScript: hovering shows the
 * same ink hover card as the public page (HOVER_CARD), from invisible hover areas laid over the
 * chart and shown with CSS, and every chart has a table view. Marks are the accent blue: a blue
 * line over a light grey fill, blue bars capped at 24px with 4px rounded data ends; grey axes,
 * gridlines and labels; comparison lines grey. The latest, unfinished period (today, this week,
 * this month) is drawn dashed or lighter. Colours come from CSS variables in globals.css.
 */
import type { ReactNode } from "react";
import { HOVER_CARD, HOVER_LABEL, HOVER_VALUE } from "@/lib/chart-style";
import { formatCount, formatDay } from "@/lib/format";
import { niceTicks } from "@/lib/scale";

export type Point = { day: string; value: number | null };
export type Series = { label: string; points: Point[]; tone?: "accent" | "previous" };

type Format = (value: number) => string;

const W = 720;
const PAD = { top: 14, right: 12, bottom: 26, left: 60 };

/**
 * One invisible hover area over a chart (positions in % of the chart's box), showing the ink hover
 * card on hover: optionally a highlighted band, a guide line and a dot on the main line.
 */
function HoverArea({
	left,
	width,
	top,
	height,
	label,
	value,
	rows = [],
	dot,
	guide = false,
	band = false,
}: {
	left: number;
	width: number;
	top: number;
	height: number;
	label: string;
	value: string;
	rows?: string[];
	dot?: number;
	guide?: boolean;
	band?: boolean;
}) {
	const opensRight = left + width / 2 <= 50;
	return (
		<div className="group/hit absolute" style={{ left: `${left}%`, width: `${width}%`, top: `${top}%`, height: `${height}%` }}>
			{band && <div className="absolute inset-0 rounded-lg bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] opacity-0 group-hover/hit:opacity-100" />}
			{guide && <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-[var(--axis)] opacity-0 group-hover/hit:opacity-100" />}
			{dot !== undefined && (
				<div className="absolute left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--card)] opacity-0 group-hover/hit:opacity-100" style={{ top: `${dot}%` }} />
			)}
			<div className={`absolute top-0 hidden group-hover/hit:block ${HOVER_CARD} ${opensRight ? "left-[calc(50%+12px)]" : "right-[calc(50%+12px)]"}`}>
				<div className={HOVER_LABEL}>{label}</div>
				<div className={HOVER_VALUE}>{value}</div>
				{rows.map((row) => (
					<div key={row} className="mt-1 text-[13px] opacity-80">
						{row}
					</div>
				))}
			</div>
		</div>
	);
}

export { niceTicks };

function TableView({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
	return (
		<details className="mt-2 text-sm">
			<summary className="cursor-pointer text-muted select-none">Show as a table</summary>
			<div className="mt-2 max-h-72 overflow-auto rounded-lg border border-line">
				<table className="w-full text-left tabular">
					<caption className="sr-only">{caption}</caption>
					<thead className="sticky top-0 bg-card text-muted">
						<tr>{head.map((h) => <th key={h} className="px-3 py-1.5 font-medium">{h}</th>)}</tr>
					</thead>
					<tbody>
						{rows.map((row, i) => (
							<tr key={i} className="border-t border-line">
								{row.map((cell, j) => <td key={j} className="px-3 py-1.5">{cell}</td>)}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</details>
	);
}

function Legend({ series }: { series: Series[] }) {
	if (series.length < 2) return null;
	return (
		<ul className="mb-2 flex flex-wrap gap-4 text-sm text-ink-2">
			{series.map((s) => (
				<li key={s.label} className="flex items-center gap-2">
					<span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ background: s.tone === "previous" ? "var(--previous)" : "var(--chart-line)" }} />
					{s.label}
				</li>
			))}
		</ul>
	);
}

/**
 * Daily values over time. The first series is the main one (dark line over a grey fill); a
 * "previous" series is drawn as a quiet grey line, aligned by position (day 1 with day 1).
 * Null values leave a gap. Optional reference lines (e.g. Core Web Vitals thresholds).
 */
export function TimeSeriesChart({
	title,
	series,
	format = formatCount,
	height = 200,
	references = [],
	unitLabel,
	axisFormat,
	unfinishedLast = false,
	viewWidth = W,
}: {
	/** Drawing width: use about 360 for charts in half-width cards, so text stays readable. */
	viewWidth?: number;
	title: string;
	series: Series[];
	format?: Format;
	height?: number;
	references?: { value: number; label: string }[];
	unitLabel?: string;
	/** The last point is a period still in progress (e.g. today): its segment is dashed. */
	unfinishedLast?: boolean;
	/** Tick labels, when they need one consistent unit (defaults to `format`). Gets the axis maximum. */
	axisFormat?: (max: number) => Format;
}) {
	const main = series[0];
	const n = main.points.length;
	const values = series.flatMap((s) => s.points.map((p) => p.value ?? 0)).concat(references.map((r) => r.value));
	const ticks = niceTicks(Math.max(0, ...values));
	const yMax = ticks[ticks.length - 1];
	const tickFormat = axisFormat ? axisFormat(yMax) : format;
	const plotW = viewWidth - PAD.left - PAD.right;
	const plotH = height - PAD.top - PAD.bottom;
	const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
	const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;

	const pathFor = (points: Point[]) => {
		let d = "";
		let pen = false;
		points.slice(0, n).forEach((p, i) => {
			if (p.value === null) {
				pen = false;
				return;
			}
			d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
			pen = true;
		});
		return d;
	};

	const areaFor = (points: Point[]) => {
		if (points.some((p) => p.value === null) || n < 2) return "";
		return `${pathFor(points)}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
	};

	const labelIndexes = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];
	const last = [...main.points].reverse().find((p) => p.value !== null);
	const summary = `${title}. ${n} days from ${formatDay(main.points[0]?.day ?? "")} to ${formatDay(main.points[n - 1]?.day ?? "")}.${last ? ` Latest ${format(last.value!)}${unitLabel ? ` ${unitLabel}` : ""}.` : ""}`;
	const hitW = n <= 1 ? plotW : plotW / (n - 1);

	return (
		<figure className="w-full">
			<Legend series={series} />
			<div className="relative">
			<svg viewBox={`0 0 ${viewWidth} ${height}`} className="h-auto w-full" role="img" aria-label={summary}>
				{ticks.map((t) => (
					<g key={t}>
						<line x1={PAD.left} x2={viewWidth - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth={1} />
						<text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular">
							{tickFormat(t)}
						</text>
					</g>
				))}
				{references.map((r) => (
					<g key={r.label}>
						<line x1={PAD.left} x2={viewWidth - PAD.right} y1={y(r.value)} y2={y(r.value)} stroke="var(--muted)" strokeWidth={1} />
						<text x={PAD.left + 4} y={y(r.value) - 4} textAnchor="start" fontSize={11} fill="var(--muted)">
							{r.label}
						</text>
					</g>
				))}
				{series
					.slice(1)
					.map((s) => (
						<path key={s.label} d={pathFor(s.points)} fill="none" stroke="var(--previous)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
					))}
				<path d={areaFor(main.points)} fill="var(--chart-fill)" />
				{unfinishedLast && n >= 2 && main.points[n - 1].value !== null && main.points[n - 2].value !== null ? (
					<>
						<path d={pathFor(main.points.slice(0, n - 1))} fill="none" stroke="var(--chart-line)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
						<path
							d={`M${x(n - 2).toFixed(1)},${y(main.points[n - 2].value!).toFixed(1)}L${x(n - 1).toFixed(1)},${y(main.points[n - 1].value!).toFixed(1)}`}
							fill="none"
							stroke="var(--chart-line)"
							strokeWidth={1.5}
							strokeDasharray="3 3"
						/>
					</>
				) : (
					<path d={pathFor(main.points)} fill="none" stroke="var(--chart-line)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
				)}
				{labelIndexes.map((i) => (
					<text key={i} x={x(i)} y={height - 6} fontSize={11} fill="var(--muted)" textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
						{main.points[i] ? formatDay(main.points[i].day) : ""}
					</text>
				))}
			</svg>
			<div aria-hidden className="absolute inset-0">
				{main.points.map((p, i) => (
					<HoverArea
						key={p.day}
						left={((x(i) - hitW / 2) / viewWidth) * 100}
						width={(hitW / viewWidth) * 100}
						top={(PAD.top / height) * 100}
						height={(plotH / height) * 100}
						guide
						dot={p.value === null ? undefined : ((y(p.value) - PAD.top) / plotH) * 100}
						label={`${formatDay(p.day, true)}${unfinishedLast && i === n - 1 ? ", so far" : ""}`}
						value={`${p.value === null ? "No data" : format(p.value)}${unitLabel && p.value !== null ? ` ${unitLabel}` : ""}`}
						rows={series.slice(1).flatMap((s) => {
							const prev = s.points[i];
							return prev ? [`${s.label} (${formatDay(prev.day)}): ${prev.value === null ? "no data" : format(prev.value)}`] : [];
						})}
					/>
				))}
			</div>
			</div>
			<TableView
				caption={title}
				head={["Day", ...series.map((s) => s.label)]}
				rows={main.points.map((p, i) => [
					formatDay(p.day, true),
					...series.map((s) => (s.points[i]?.value === null || s.points[i] === undefined ? "–" : format(s.points[i].value!))),
				])}
			/>
		</figure>
	);
}

/** Vertical columns with labels underneath, e.g. visitors per month or commits per week. */
export function ColumnChart({
	title,
	bars,
	format = formatCount,
	height = 200,
	unfinishedLast = false,
	viewWidth = W,
	showTable = true,
}: {
	/** Drawing width: about 360 for narrow screens, so labels stay readable. */
	viewWidth?: number;
	/** Hide the table view (when another copy of the chart on the page already has it). */
	showTable?: boolean;
	title: string;
	bars: { label: string; value: number; detail?: string }[];
	format?: Format;
	height?: number;
	/** The last bar is a period still in progress: it's drawn lighter and labelled "so far". */
	unfinishedLast?: boolean;
}) {
	const ticks = niceTicks(Math.max(0, ...bars.map((b) => b.value)));
	const yMax = ticks[ticks.length - 1];
	const plotW = viewWidth - PAD.left - PAD.right;
	const plotH = height - PAD.top - PAD.bottom;
	const band = plotW / Math.max(1, bars.length);
	const barW = Math.min(24, band * 0.6);
	const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;
	const every = Math.ceil(bars.length / (viewWidth < 500 ? 6 : 12));
	const total = bars.reduce((t, b) => t + b.value, 0);

	return (
		<figure className="w-full">
			<div className="relative">
			<svg viewBox={`0 0 ${viewWidth} ${height}`} className="h-auto w-full" role="img" aria-label={`${title}. Total ${format(total)}.`}>
				{ticks.map((t) => (
					<g key={t}>
						<line x1={PAD.left} x2={viewWidth - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth={1} />
						<text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular">
							{format(t)}
						</text>
					</g>
				))}
				{bars.map((b, i) => {
					const cx = PAD.left + band * i + band / 2;
					const h = Math.max(0, y(0) - y(b.value));
					const r = Math.min(4, h, barW / 2);
					const top = y(b.value);
					const left = cx - barW / 2;
					const d =
						h <= 0
							? ""
							: `M${left},${y(0)}V${top + r}Q${left},${top} ${left + r},${top}H${left + barW - r}Q${left + barW},${top} ${left + barW},${top + r}V${y(0)}Z`;
					const unfinished = unfinishedLast && i === bars.length - 1;
					return (
						<g key={b.label}>
							<path d={d} fill={unfinished ? "var(--chart-soft)" : "var(--chart-bar)"} />
							{i % every === 0 && (
								<text x={cx} y={height - 6} fontSize={11} fill="var(--muted)" textAnchor="middle">
									{b.label}
								</text>
							)}
						</g>
					);
				})}
			</svg>
			<div aria-hidden className="absolute inset-0">
				{bars.map((b, i) => (
					<HoverArea
						key={b.label}
						left={((PAD.left + band * i) / viewWidth) * 100}
						width={(band / viewWidth) * 100}
						top={(PAD.top / height) * 100}
						height={(plotH / height) * 100}
						band
						label={`${b.detail ?? b.label}${unfinishedLast && i === bars.length - 1 ? ", so far" : ""}`}
						value={format(b.value)}
					/>
				))}
			</div>
			</div>
			{showTable && <TableView caption={title} head={["", "Value"]} rows={bars.map((b) => [b.detail ?? b.label, format(b.value)])} />}
		</figure>
	);
}

/**
 * A small filled trend with no axes: light grey fill, dark line. When `unfinishedLast`, the
 * final segment (the period still in progress) is dashed. Stretches to its container's width.
 */
export function Sparkline({
	points,
	label,
	height = 56,
	unfinishedLast = false,
}: {
	points: Point[];
	label: string;
	height?: number;
	unfinishedLast?: boolean;
}) {
	const width = 300;
	const values = points.map((p) => p.value ?? 0);
	const max = Math.max(1, ...values);
	const n = values.length;
	const x = (i: number) => (n <= 1 ? width / 2 : (i / (n - 1)) * width);
	const y = (v: number) => height - 1 - (v / max) * (height - 6);
	const line = (from: number, to: number) => values.slice(from, to).map((v, i) => `${i ? "L" : "M"}${x(from + i).toFixed(1)},${y(v).toFixed(1)}`).join("");
	const solidEnd = unfinishedLast && n >= 2 ? n - 1 : n;
	const area = n > 1 ? `${line(0, n)}L${x(n - 1)},${height}L${x(0)},${height}Z` : "";
	return (
		<svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block h-auto w-full" style={{ height }} role="img" aria-label={label}>
			<title>{label}</title>
			<path d={area} fill="var(--chart-fill)" />
			<path d={line(0, solidEnd)} fill="none" stroke="var(--chart-line)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
			{solidEnd < n && (
				<path d={line(n - 2, n)} fill="none" stroke="var(--muted)" strokeWidth={1.25} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
			)}
		</svg>
	);
}

/** A ranked list with a quiet share bar behind each row. */
export function RankedList({
	title,
	rows,
	keyLabel,
	valueLabel = "Visitors",
	secondaryLabel = "Views",
	emptyText = "Nothing yet.",
	formatKey = (key: string) => key,
}: {
	title: string;
	rows: { key: string; value: number; secondary?: number }[];
	keyLabel: string;
	valueLabel?: string;
	secondaryLabel?: string;
	emptyText?: string;
	formatKey?: (key: string) => ReactNode;
}) {
	if (rows.length === 0) return <p className="text-sm text-muted">{emptyText}</p>;
	const max = Math.max(1, ...rows.map((r) => r.value));
	const hasSecondary = rows.some((r) => r.secondary !== undefined);
	return (
		// Fixed layout: long names truncate inside the box instead of widening the page.
		<table className="w-full table-fixed text-sm tabular">
			<caption className="sr-only">{title}</caption>
			<thead className="text-muted">
				<tr>
					<th className="pb-1 text-left font-medium">{keyLabel}</th>
					<th className="w-24 pb-1 text-right font-medium">{valueLabel}</th>
					{hasSecondary && <th className="w-20 pb-1 pl-3 text-right font-medium">{secondaryLabel}</th>}
				</tr>
			</thead>
			<tbody>
				{rows.map((row) => (
					<tr key={row.key} className="group">
						<td className="relative py-1 pr-3">
							<span aria-hidden className="absolute inset-y-0.5 left-0 rounded" style={{ width: `${(row.value / max) * 100}%`, background: "var(--pill)" }} />
							<span className="relative block truncate pl-2" title={row.key}>
								{formatKey(row.key)}
							</span>
						</td>
						<td className="py-1 text-right">{formatCount(row.value)}</td>
						{hasSecondary && <td className="py-1 pl-3 text-right text-ink-2">{row.secondary === undefined ? "–" : formatCount(row.secondary)}</td>}
					</tr>
				))}
			</tbody>
		</table>
	);
}

export type Status = "good" | "warning" | "serious" | "critical" | "none";

export const STATUS_LABEL: Record<Status, string> = {
	good: "Good",
	warning: "Needs improvement",
	serious: "Poor",
	critical: "Down",
	none: "No data",
};

const STATUS_ICON: Record<Status, string> = { good: "✓", warning: "!", serious: "!", critical: "✕", none: "–" };

/** A status always carries an icon and a label, never colour alone. */
export function StatusBadge({ status, label }: { status: Status; label?: string }) {
	const colour = status === "none" ? "var(--muted)" : `var(--${status})`;
	return (
		<span className="inline-flex items-center gap-1.5 text-sm text-ink-2">
			<span
				aria-hidden
				className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
				// Glyphs at 3:1 or more: dark on amber and orange, white on green and red, the page colour on grey.
				style={{ background: colour, color: status === "warning" || status === "serious" ? "#0b0b0b" : status === "none" ? "var(--on-muted)" : "#ffffff" }}
			>
				{STATUS_ICON[status]}
			</span>
			{label ?? STATUS_LABEL[status]}
		</span>
	);
}

export function uptimeStatus(checks: number, up: number): Status {
	if (checks === 0) return "none";
	const ratio = up / checks;
	if (ratio >= 0.999) return "good";
	if (ratio >= 0.99) return "warning";
	if (ratio >= 0.95) return "serious";
	return "critical";
}

const UPTIME_LEGEND: { status: Status; label: string }[] = [
	{ status: "good", label: "99.9% or more" },
	{ status: "warning", label: "99–99.9%" },
	{ status: "serious", label: "95–99%" },
	{ status: "critical", label: "Under 95%" },
	{ status: "none", label: "No checks" },
];

/** One small bar per day, coloured by uptime, with an icon-and-label legend. */
export function UptimeStrip({ days }: { days: { day: string; checks: number; up: number }[] }) {
	const width = 720;
	const gap = 2;
	const barW = (width - gap * (days.length - 1)) / Math.max(1, days.length);
	const summaryUp = days.reduce((t, d) => t + d.up, 0);
	const summaryChecks = days.reduce((t, d) => t + d.checks, 0);
	const label = `Daily uptime for ${days.length} days: ${summaryChecks ? ((summaryUp / summaryChecks) * 100).toFixed(2) : "–"}% overall.`;
	return (
		<figure>
			<div className="relative">
				<svg viewBox={`0 0 ${width} 36`} className="h-auto w-full" role="img" aria-label={label}>
					{days.map((d, i) => {
						const status = uptimeStatus(d.checks, d.up);
						return <rect key={d.day} x={i * (barW + gap)} y={0} width={barW} height={36} rx={2} fill={status === "none" ? "var(--grid)" : `var(--${status})`} />;
					})}
				</svg>
				<div aria-hidden className="absolute inset-0">
					{days.map((d, i) => (
						<HoverArea
							key={d.day}
							left={((i * (barW + gap)) / width) * 100}
							width={((barW + gap) / width) * 100}
							top={0}
							height={100}
							band
							label={formatDay(d.day, true)}
							value={d.checks ? `${((d.up / d.checks) * 100).toFixed(2)}% up` : "No checks"}
							rows={d.checks ? [`${d.up} of ${d.checks} checks`] : []}
						/>
					))}
				</div>
			</div>
			<ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
				{UPTIME_LEGEND.map((item) => (
					<li key={item.status}>
						<StatusBadge status={item.status} label={item.label} />
					</li>
				))}
			</ul>
			<TableView
				caption="Daily uptime"
				head={["Day", "Uptime", "Checks"]}
				rows={days.map((d) => [formatDay(d.day, true), d.checks ? `${((d.up / d.checks) * 100).toFixed(2)}%` : "–", d.checks])}
			/>
		</figure>
	);
}

/** Funnel steps as horizontal bars, with the share kept from the step before. */
export function FunnelChart({ steps }: { steps: { label: string; visitors: number; fromPrevious: number | null; fromFirst: number | null }[] }) {
	const max = Math.max(1, ...steps.map((s) => s.visitors));
	return (
		<ol className="space-y-3">
			{steps.map((step, i) => (
				<li key={`${i}-${step.label}`}>
					<div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
						<span className="font-medium">
							{i + 1}. {step.label}
						</span>
						<span className="tabular text-ink-2">
							{formatCount(step.visitors)}
							{step.fromPrevious !== null && <span className="text-muted"> · {Math.round(step.fromPrevious * 100)}% of the step before</span>}
						</span>
					</div>
					<div className="h-3 rounded-full bg-pill" role="presentation">
						<div className="h-3 rounded-full" style={{ width: `${(step.visitors / max) * 100}%`, background: "var(--chart-bar)" }} />
					</div>
				</li>
			))}
		</ol>
	);
}
