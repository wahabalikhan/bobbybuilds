import { SectionHeading } from "@/components/admin/ui";
import { addDays } from "@/lib/days";
import { formatMonth, formatPence, formatWhole } from "@/lib/format";
import type { Month, PublicSnapshot } from "@/lib/public/snapshot";

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

function Figure({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
	return (
		<div className="min-w-0">
			<dt className="text-sm text-muted">{label}</dt>
			<dd className="mt-1.5 flex flex-wrap items-end gap-x-3 gap-y-2">
				<span className="tabular text-3xl font-semibold tracking-tight">{value}</span>
				{children}
			</dd>
		</div>
	);
}

/**
 * Days building, visitors in the last 30 days (with the 12-month trend), and this month's running
 * costs and revenue (even £0), with the costs by service tucked away. Quiet: no cards, just figures.
 */
export function HonestNumbers({ snapshot }: { snapshot: PublicSnapshot }) {
	const { profile, money, today } = snapshot;
	const month = money ? formatMonth(money.month) : null;
	return (
		<section id="numbers" aria-labelledby="numbers-heading" className="scroll-mt-20">
			<SectionHeading id="numbers-heading" relaxed>
				The honest numbers
			</SectionHeading>
			<dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
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
						<Figure label={`Running costs, ${month}`} value={formatPence(money.costPence)} />
						<Figure label={`Revenue, ${month}`} value={formatPence(money.revenuePence)} />
					</>
				)}
			</dl>
			{money && money.costs.length > 0 && (
				<details className="group mt-8 border-t border-line pt-4">
					<summary className="inline-flex list-none items-center gap-2 rounded-sm text-sm font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
						Where the money goes
						<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="text-muted transition-transform group-open:rotate-180">
							<path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					</summary>
					<table className="mt-4 w-full max-w-md text-sm">
						<caption className="sr-only">Running costs by service, {month}</caption>
						<tbody>
							{money.costs.map((c) => (
								<tr key={c.service} className="border-b border-line last:border-0">
									<th scope="row" className="py-2 text-left font-normal text-ink-2">
										{c.service}
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
								<td className="tabular pt-3 text-right font-medium">{formatPence(money.costPence)}</td>
							</tr>
						</tfoot>
					</table>
				</details>
			)}
		</section>
	);
}
