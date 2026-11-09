import { SectionHeading } from "@/components/admin/ui";
import { PUBLIC_SECTION_DIVIDERS } from "@/lib/layout";
import { addDays } from "@/lib/days";
import { formatMonth, formatPence, formatWhole } from "@/lib/format";
import type { Month, PublicCost, PublicSnapshot } from "@/lib/public/snapshot";

/** Days from the start date to today, counting both (the first day is day 1). */
export function daysBuilding(since: string, today: string): number {
	let days = 0;
	for (let day = since; day <= today; day = addDays(day, 1)) days += 1;
	return days;
}

/**
 * The 12-month visitors trend as a tiny monochrome line with a light fill. This month (not over
 * yet) is the dashed last step. Screen readers get the figures as a list instead.
 */
function Trend({ months }: { months: Month[] }) {
	const w = 96;
	const h = 28;
	const max = Math.max(1, ...months.map((m) => m.value));
	const points = months.map((m, i) => [(i / (months.length - 1)) * w, h - 2 - (m.value / max) * (h - 4)] as const);
	const line = (pts: readonly (readonly [number, number])[]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
	const finished = points.slice(0, -1);
	return (
		<>
			<svg aria-hidden viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="overflow-visible">
				<path d={`${line(points)} L${w} ${h} L0 ${h} Z`} fill="var(--chart-fill)" />
				<path d={line(finished)} fill="none" stroke="var(--chart-neutral)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
				<path d={line(points.slice(-2))} fill="none" stroke="var(--chart-neutral)" strokeWidth="1.5" strokeDasharray="2 2.5" strokeLinecap="round" />
			</svg>
			<ul className="sr-only">
				{months.map((m, i) => (
					<li key={m.month}>
						{formatMonth(m.month)}: {formatWhole(m.value)} visitors
						{i === months.length - 1 ? " so far" : ""}
					</li>
				))}
			</ul>
		</>
	);
}

function Figure({ label, value, note, children }: { label: string; value: string; note?: string; children?: React.ReactNode }) {
	return (
		<div className="min-w-0">
			<dt className="text-sm text-muted">{label}</dt>
			<dd className="mt-1.5">
				<span className="flex flex-wrap items-end gap-x-3 gap-y-2">
					<span className="tabular text-3xl font-semibold tracking-tight">{value}</span>
					{children}
				</span>
				{note && <span className="mt-1 block text-sm text-muted">{note}</span>}
			</dd>
		</div>
	);
}

/** One group of costs with its total. Yearly bills show their monthly share, labelled with the yearly price. */
function CostTable({ title, costs, total, month }: { title: string; costs: PublicCost[]; total: number; month: string }) {
	return (
		<table className="w-full max-w-md text-sm">
			<caption className="pb-2 text-left font-medium">
				{title}
				<span className="sr-only">, {month}, per month</span>
			</caption>
			<tbody>
				{costs.map((c) => (
					<tr key={`${c.service}|${c.yearlyPence === null ? "m" : "y"}`} className="border-b border-line last:border-0">
						<th scope="row" className="py-2 text-left font-normal text-ink-2">
							{c.service}
							{c.yearlyPence !== null && <span className="text-muted"> ({formatPence(c.yearlyPence)} a year)</span>}
						</th>
						<td className="tabular py-2 text-right">{formatPence(c.pence)}</td>
					</tr>
				))}
			</tbody>
			<tfoot>
				<tr>
					<th scope="row" className="pt-3 text-left font-medium">
						Total
					</th>
					<td className="tabular pt-3 text-right font-medium">{formatPence(total)}</td>
				</tr>
			</tfoot>
		</table>
	);
}

/**
 * Days building, visitors in the last 30 days (with the trend since the first product's month), and
 * this month's running costs and revenue (even £0). Running costs are only what keeps the products
 * live; tools I build with (the Claude subscription) are counted separately, noted under the figure
 * and listed with their own total in "Where the money goes". Quiet: no cards, just figures.
 */
export function HonestNumbers({ snapshot }: { snapshot: PublicSnapshot }) {
	const { profile, money, today } = snapshot;
	const month = money ? formatMonth(money.month) : null;
	return (
		<section id="numbers" aria-labelledby="numbers-heading" className="scroll-mt-20">
			<SectionHeading id="numbers-heading" relaxed divider={PUBLIC_SECTION_DIVIDERS}>
				The honest numbers
			</SectionHeading>
			<dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
				{profile.buildingSince && profile.buildingSince <= today && <Figure label="Days building" value={formatWhole(daysBuilding(profile.buildingSince, today))} />}
				<Figure label="Visitors, last 30 days" value={formatWhole(snapshot.visitors30)}>
					{snapshot.monthly.length > 1 && (
						<span className="mb-1.5 block">
							<Trend months={snapshot.monthly} />
						</span>
					)}
				</Figure>
				{money && (
					<>
						<Figure label={`Running costs, ${month}`} value={formatPence(money.runningPence)} note={money.toolsPence > 0 ? `Plus ${formatPence(money.toolsPence)} on tools I build with` : undefined} />
						<Figure label={`Revenue, ${month}`} value={formatPence(money.revenuePence)} />
					</>
				)}
			</dl>
			{money && money.running.length + money.tools.length > 0 && (
				<details className="group mt-8">
					<summary className="inline-flex list-none items-center gap-2 rounded-sm text-sm font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
						Where the money goes (monthly)
						<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="text-muted transition-transform group-open:rotate-180">
							<path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					</summary>
					<div className="mt-4 space-y-6">
						{money.running.length > 0 && <CostTable title="Running costs" costs={money.running} total={money.runningPence} month={month!} />}
						{money.tools.length > 0 && <CostTable title="Tools I build with" costs={money.tools} total={money.toolsPence} month={month!} />}
					</div>
				</details>
			)}
		</section>
	);
}
