"use client";

import { useId, useState, type ReactNode } from "react";
import { formatPence, formatWhole } from "@/lib/format";
import { CARD_SMALL } from "@/lib/layout";
import type { PublicCost } from "@/lib/public/snapshot";
import { CountUp } from "./count-up";

export type TilesData = {
	/** Days building (day 1 included) and the start day in words ("31 Oct"); null until it's set. */
	building: { days: number; since: string } | null;
	/** Visitors in the last 30 days, the 30 days before, and per day for the last 30 (today last). */
	visitors: { value: number; previous: number; daily: number[] };
	/** The latest month with costs or revenue entered; null until anything is. */
	money: { monthShort: string; monthLong: string; runningPence: number; toolsPence: number; revenuePence: number; running: PublicCost[]; tools: PublicCost[] } | null;
};

const whole = (n: number) => formatWhole(n);

/** One tile: a label, a big figure (sized to fit its tile, via a container query) and a note. */
function Tile({ label, value, children, dark = false }: { label: string; value: ReactNode; children?: ReactNode; dark?: boolean }) {
	return (
		<div className={`@container flex min-h-[184px] min-w-0 flex-col p-5 sm:p-6 lg:min-h-[203px] ${dark ? "rounded-[24px] bg-ink text-white" : CARD_SMALL}`}>
			<p className={`text-[15px] ${dark ? "text-white/70" : "text-muted"}`}>{label}</p>
			<p className="tabular mt-3 text-[length:min(2.875rem,27cqi)] font-extrabold leading-none tracking-[-0.04em]">{value}</p>
			{children}
		</div>
	);
}

/** The last 30 days of visitors as a tiny line in the accent blue, at the foot of its tile. */
function Sparkline({ values }: { values: number[] }) {
	const w = 120;
	const h = 28;
	const max = Math.max(1, ...values);
	const d = values.map((v, i) => `${i ? "L" : "M"}${((i / Math.max(1, values.length - 1)) * w).toFixed(1)} ${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(" ");
	return (
		<svg aria-hidden viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-auto h-7 w-full overflow-visible pt-3">
			<path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
		</svg>
	);
}

/** One group of costs with its total; yearly bills show their monthly share, labelled with the yearly price. */
function CostTable({ title, costs, total, month }: { title: string; costs: PublicCost[]; total: number; month: string }) {
	return (
		<table className="w-full text-[15px]">
			<caption className="pb-2 text-left font-semibold text-ink">
				{title}
				<span className="sr-only">, {month}, per month</span>
			</caption>
			<tbody>
				{costs.map((c) => (
					<tr key={`${c.service}|${c.yearlyPence === null ? "m" : "y"}`} className="border-b border-line">
						<th scope="row" className="py-2.5 pr-4 text-left font-normal text-ink-2">
							{c.service}
							{c.yearlyPence !== null && <span className="text-muted"> ({formatPence(c.yearlyPence)} a year)</span>}
						</th>
						<td className="tabular py-2.5 text-right">{formatPence(c.pence)}</td>
					</tr>
				))}
			</tbody>
			<tfoot>
				<tr>
					<th scope="row" className="pt-3 text-left font-semibold">
						Total
					</th>
					<td className="tabular pt-3 text-right font-semibold">{formatPence(total)}</td>
				</tr>
			</tfoot>
		</table>
	);
}

/**
 * The four number tiles (days building, visitors in 30 days with a small trend line, this month's
 * running costs and revenue), two per row on phones. "See breakdown" in the costs tile opens "Where
 * the money goes" in a card under the tiles. `tilesClass` and `panelClass` place both in the bento grid.
 */
export function NumberTiles({ data, tilesClass, panelClass }: { data: TilesData; tilesClass: string; panelClass: string }) {
	const [open, setOpen] = useState(false);
	const panelId = useId();
	const { building, visitors, money } = data;
	const change = visitors.value - visitors.previous;
	const hasBreakdown = !!money && money.running.length + money.tools.length > 0;

	return (
		<>
			<section id="numbers" aria-label="The numbers" className={`grid scroll-mt-6 grid-cols-2 gap-4 md:grid-cols-4 ${tilesClass}`}>
				{building && (
					<Tile label="Days building" value={<CountUp value={building.days} format={whole} />}>
						<p className="mt-3 text-[15px] text-muted">Since {building.since}</p>
					</Tile>
				)}
				<Tile label="Visitors, 30 days" value={<CountUp value={visitors.value} format={whole} />}>
					<p className={`mt-3 text-[15px] ${change > 0 ? "text-shipped" : "text-muted"}`}>
						{change === 0 ? "Same as the 30 days before" : `${change > 0 ? "Up" : "Down"} from ${formatWhole(visitors.previous)} in the 30 days before`}
					</p>
					{visitors.daily.length > 1 && <Sparkline values={visitors.daily} />}
				</Tile>
				{money && (
					<>
						<Tile label={`Costs, ${money.monthShort}`} value={<CountUp value={money.runningPence} format={formatPence} />}>
							{money.toolsPence > 0 && <p className="mt-3 text-[15px] text-muted">Plus {formatPence(money.toolsPence)} on tools</p>}
							{hasBreakdown && (
								<button
									type="button"
									aria-expanded={open}
									aria-controls={panelId}
									onClick={() => setOpen((o) => !o)}
									className="-mx-2 mt-auto inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg px-2 text-[15px] font-semibold text-ink underline underline-offset-4 hover:text-accent"
								>
									{open ? "Hide breakdown" : "See breakdown"}
									<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}>
										<path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
									</svg>
								</button>
							)}
						</Tile>
						<Tile dark label={`Revenue, ${money.monthShort}`} value={<CountUp value={money.revenuePence} format={formatPence} />}>
							{money.revenuePence === 0 && <p className="mt-3 text-[15px] text-white/70">Free, for now</p>}
						</Tile>
					</>
				)}
			</section>
			{hasBreakdown && (
				<section id={panelId} hidden={!open} aria-labelledby={`${panelId}-title`} className={`${CARD_SMALL} p-6 sm:p-8 ${panelClass}`}>
					<h2 id={`${panelId}-title`} className="text-xl font-extrabold tracking-[-0.03em]">
						Where the money goes in {money.monthLong}
					</h2>
					<p className="mt-1 text-[15px] text-muted">Per month. Yearly bills are split over 12 months.</p>
					<div className="mt-5 grid gap-8 md:grid-cols-2">
						{money.running.length > 0 && <CostTable title="Running costs" costs={money.running} total={money.runningPence} month={money.monthLong} />}
						{money.tools.length > 0 && <CostTable title="Tools I build with" costs={money.tools} total={money.toolsPence} month={money.monthLong} />}
					</div>
				</section>
			)}
		</>
	);
}
