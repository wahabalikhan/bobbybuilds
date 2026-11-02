"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import type { PublicGithub } from "@/lib/public/snapshot";
import { formatMonth, formatWhole } from "@/lib/format";

/** GitHub's own levels: none, 1–3, 4–6, 7–9, 10+ (colours in globals.css: --gh-0 … --gh-4). */
export function level(count: number): number {
	return count <= 0 ? 0 : count <= 3 ? 1 : count <= 6 ? 2 : count <= 9 ? 3 : 4;
}

const DAY = 86_400_000;
const longDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
// "Sep", not en-GB's "Sept".
const shortMonth = (date: Date) => formatMonth(date.toISOString().slice(0, 7)).slice(0, 3);

/**
 * The last year of GitHub contributions as GitHub draws it: a column per week (Sunday to
 * Saturday), darker green for more. Hovering a square shows that day's count. On narrow
 * screens it scrolls sideways, starting at the latest week.
 */
export function ContributionGraph({ github }: { github: PublicGithub }) {
	const start = Date.parse(`${github.firstDay}T00:00:00Z`);
	const offset = new Date(start).getUTCDay();
	const columns = Math.ceil((offset + github.counts.length) / 7);
	const total = github.counts.reduce((t, c) => t + c, 0);
	const scroller = useRef<HTMLDivElement>(null);
	const wrapper = useRef<HTMLDivElement>(null);
	const [hover, setHover] = useState<{ i: number; left: number; top: number; side: number } | null>(null);

	useEffect(() => {
		const el = scroller.current;
		if (el) el.scrollLeft = el.scrollWidth;
	}, []);

	// A month label over the first week that starts in that month (skipping one squeezed in at the very start).
	const months: { col: number; label: string }[] = [];
	for (let col = 0; col < columns; col++) {
		const first = start + (col * 7 - offset) * DAY;
		const day = new Date(Math.max(first, start));
		if (col === 0 ? day.getUTCDate() <= 14 : new Date(first).getUTCDate() <= 7) {
			if (!months.length || col - months[months.length - 1].col >= 3) months.push({ col, label: shortMonth(day) });
		}
	}

	const onOver = (event: MouseEvent<HTMLDivElement>) => {
		const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-i]");
		if (!cell || !wrapper.current) return setHover(null);
		const box = wrapper.current.getBoundingClientRect();
		const rect = cell.getBoundingClientRect();
		const left = rect.left - box.left + rect.width / 2;
		// Centred over the square, but kept inside the card near either edge.
		setHover({ i: Number(cell.dataset.i), left, top: rect.top - box.top, side: left / box.width });
	};

	const grid: CSSProperties = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridTemplateRows: "repeat(7, minmax(0, 1fr))", gridAutoFlow: "column" };
	const count = hover ? github.counts[hover.i] : 0;

	return (
		<div>
			<p className="text-ink-2">
				<span className="font-semibold text-ink tabular">{formatWhole(total)}</span> contributions in the last year
			</p>
			<div ref={wrapper} className="relative mt-5" onMouseLeave={() => setHover(null)}>
			<div ref={scroller} className="overflow-x-auto pb-1" onScroll={() => setHover(null)}>
				<div className="min-w-[560px]">
					<div className="ml-9 grid text-xs text-muted" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} aria-hidden>
						{months.map((m) => (
							<span key={m.col} style={{ gridColumn: `${m.col + 1} / span 3` }}>
								{m.label}
							</span>
						))}
					</div>
					<div className="mt-1.5 flex">
						<div className="sticky left-0 z-10 flex w-9 shrink-0 flex-col gap-[3px] bg-card text-xs leading-none text-muted" aria-hidden>
							{["", "Mon", "", "Wed", "", "Fri", ""].map((day, i) => (
								<span key={i} className="flex flex-1 items-center">
									{day}
								</span>
							))}
						</div>
						<div className="grid flex-1 gap-[3px]" style={grid} onMouseOver={onOver} role="img" aria-label={`${formatWhole(total)} GitHub contributions in the last year.`}>
							{Array.from({ length: offset }, (_, i) => (
								<span key={`pad-${i}`} />
							))}
							{github.counts.map((c, i) => (
								<span key={i} data-i={i} className="aspect-square rounded-[3px]" style={{ background: `var(--gh-${level(c)})` }} />
							))}
						</div>
					</div>
				</div>
			</div>
				{hover && (
					<div
						aria-hidden
						className="pointer-events-none absolute z-20 whitespace-nowrap rounded-xl border border-line bg-card px-3 py-2 text-sm shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
						style={{ left: hover.left, top: hover.top - 6, transform: `translate(${hover.side < 0.3 ? "-12px" : hover.side > 0.7 ? "calc(-100% + 12px)" : "-50%"}, -100%)` }}
					>
						<span className="font-semibold text-ink">{count === 0 ? "No" : formatWhole(count)} contribution{count === 1 ? "" : "s"}</span>
						<span className="text-muted"> on {longDate.format(new Date(start + hover.i * DAY))}</span>
					</div>
				)}
			</div>
			<div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted" aria-hidden>
				Less
				{[0, 1, 2, 3, 4].map((l) => (
					<span key={l} className="h-[11px] w-[11px] rounded-[3px]" style={{ background: `var(--gh-${l})` }} />
				))}
				More
			</div>
		</div>
	);
}
