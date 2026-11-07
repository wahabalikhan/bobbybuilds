import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ColumnChart, niceTicks, RankedList, Sparkline, StatusBadge, TimeSeriesChart, UptimeStrip, uptimeStatus } from "@/components/charts";
import { chartCeiling, tidyCeiling } from "@/lib/scale";
import { COLLECTING, WeekChart } from "@/components/public/mono-charts";
import { change, formatChange, formatCount, formatDay, formatDuration, formatMs, msAxis, timeAgo } from "@/lib/format";

const days = (values: (number | null)[]) => values.map((value, i) => ({ day: `2026-10-${String(i + 1).padStart(2, "0")}`, value }));

describe("niceTicks", () => {
	it("picks clean steps", () => {
		expect(niceTicks(97)).toEqual([0, 50, 100]);
		expect(niceTicks(4000)).toEqual([0, 1000, 2000, 3000, 4000]);
		expect(niceTicks(0)).toEqual([0, 1]);
		expect(niceTicks(Number.NaN)).toEqual([0, 1]);
	});

	it("uses whole numbers only, never repeats a label, and shows just 0 and the top for small numbers", () => {
		expect(niceTicks(1)).toEqual([0, 1]);
		expect(niceTicks(1, { min: 3 })).toEqual([0, 3]);
		expect(niceTicks(4, { min: 3 })).toEqual([0, 4]);
		expect(niceTicks(5)).toEqual([0, 5]);
		expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
		expect(niceTicks(0.4)).toEqual([0, 1]);
		for (let max = 0; max <= 2000; max += 1) {
			const ticks = niceTicks(max, { min: 3 });
			expect(ticks.every(Number.isInteger)).toBe(true);
			expect(new Set(ticks).size).toBe(ticks.length);
			expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(Math.max(3, max));
		}
	});
});

describe("chartCeiling", () => {
	it("tops each chart at its own highest value plus about 15%, rounded up to a tidy number, at least 5", () => {
		expect(chartCeiling(0)).toBe(5);
		expect(chartCeiling(2)).toBe(5);
		expect(chartCeiling(7)).toBe(9);
		expect(chartCeiling(20)).toBe(25);
		expect(chartCeiling(80)).toBe(100);
		expect(chartCeiling(1000)).toBe(1200);
		expect(chartCeiling(Number.NaN)).toBe(5);
		expect([1, 2.3, 12, 87, 103].map(tidyCeiling)).toEqual([1, 3, 12, 90, 120]);
	});
});

describe("charts render without broken numbers", () => {
	it("draws a time series with a summary, hover cards and a table", () => {
		const html = renderToStaticMarkup(
			<TimeSeriesChart
				title="Visitors"
				series={[
					{ label: "This period", points: days([3, 5, null, 8]) },
					{ label: "Previous", points: days([1, 2, 3, 4]), tone: "previous" },
				]}
			/>,
		);
		expect(html).toContain('aria-label="Visitors. 4 days from 1 Oct to 4 Oct. Latest 8."');
		// The ink hover card for each day: the date, the value (or "No data") and the previous period.
		expect(html).toContain(">3 Oct 2026</div>");
		expect(html).toContain(">No data</div>");
		expect(html).toContain(">Previous (3 Oct): 3</div>");
		expect(html).not.toContain("<title>");
		expect(html).toContain("Show as a table");
		expect(html).toContain("This period");
		expect(html).not.toMatch(/NaN|Infinity|undefined/);
	});

	it("copes with no data at all", () => {
		const html = renderToStaticMarkup(<TimeSeriesChart title="Empty" series={[{ label: "x", points: days([0, 0, 0]) }]} />);
		expect(html).not.toMatch(/NaN|Infinity/);
		expect(renderToStaticMarkup(<ColumnChart title="Zero" bars={[{ label: "Jan", value: 0 }]} />)).not.toMatch(/NaN|Infinity/);
		expect(renderToStaticMarkup(<Sparkline points={days([])} label="none" />)).not.toMatch(/NaN|Infinity/);
		expect(renderToStaticMarkup(<RankedList title="t" keyLabel="Page" rows={[]} emptyText="Nothing yet." />)).toContain("Nothing yet.");
	});

	it("keeps one unit on a milliseconds axis", () => {
		const html = renderToStaticMarkup(
			<TimeSeriesChart title="LCP" series={[{ label: "LCP", points: days([900, 2400, 3900]) }]} format={formatMs} axisFormat={msAxis} />,
		);
		const ticks = [...html.matchAll(/class="tabular">([^<]+)</g)].map((m) => m[1]);
		expect(ticks).toEqual(["0 s", "1 s", "2 s", "3 s", "4 s"]);
	});

	it("caps bars at 24px wide", () => {
		const html = renderToStaticMarkup(<ColumnChart title="Two" bars={[{ label: "A", value: 5 }, { label: "B", value: 10 }]} />);
		const widths = [...html.matchAll(/H([\d.]+)Q/g)].length;
		expect(widths).toBeGreaterThan(0);
		const lefts = [...html.matchAll(/M([\d.]+),[\d.]+V[\d.]+Q[\d.]+,[\d.]+ ([\d.]+)/g)].map((m) => Number(m[2]) - Number(m[1]));
		for (const r of lefts) expect(r).toBeLessThanOrEqual(4);
	});

	it("never shows status by colour alone", () => {
		// The icon plus a plain sentence (batch 3: no badge words, so the sentence is always given).
		const html = renderToStaticMarkup(<StatusBadge status="critical" label="Tech Jobs is down." />);
		expect(html).toContain("✕");
		expect(html).toContain("Tech Jobs is down.");
		const strip = renderToStaticMarkup(<UptimeStrip days={[{ day: "2026-11-01", checks: 288, up: 288 }, { day: "2026-11-02", checks: 0, up: 0 }]} />);
		expect(strip).toContain("99.9% or more");
		expect(strip).toContain(">1 Nov 2026</div>");
		expect(strip).toContain(">100.00% up</div>");
		expect(strip).toContain(">288 of 288 checks</div>");
		expect(strip).toContain(">No checks</div>");
	});

	it("grades uptime", () => {
		expect([uptimeStatus(1000, 1000), uptimeStatus(1000, 995), uptimeStatus(1000, 960), uptimeStatus(1000, 900), uptimeStatus(0, 0)]).toEqual([
			"good", "warning", "serious", "critical", "none",
		]);
	});
});

describe("formatting", () => {
	it("formats numbers, changes, days and durations in UK English", () => {
		expect(formatCount(1284)).toBe("1,284");
		expect(formatCount(12_900)).toBe("12.9K");
		expect(formatChange(change(120, 100))).toBe("+20%");
		expect(formatChange(change(80, 100))).toBe("−20%");
		expect(formatChange(change(5, 0))).toBe("new");
		expect(formatDay("2026-11-02")).toBe("2 Nov");
		expect(formatDay("2026-11-02", true)).toBe("2 Nov 2026");
		expect(formatDuration(102_000)).toBe("1m 42s");
		expect(formatMs(2460)).toBe("2.46 s");
		expect(formatMs(202)).toBe("202 ms");
		expect(timeAgo(0, 4 * 60_000)).toBe("4 minutes ago");
	});
});

describe("WeekChart", () => {
	const series = (n: number) => Array.from({ length: n }, (_, i) => ({ day: `2026-11-0${i + 1}`, value: i + 1 }));
	it("shows a note instead of a line with under 3 days of data", () => {
		const html = renderToStaticMarkup(<WeekChart weeks={series(2)} label="New project." period="day" />);
		expect(html).toContain(COLLECTING);
		expect(html).not.toContain('stroke="var(--accent)"');
		expect(html).not.toContain('tabindex="0"');
	});
	it("draws the line from 3 days, edge to edge, ending at today", () => {
		const html = renderToStaticMarkup(<WeekChart weeks={series(3)} label="New project." period="day" />);
		expect(html).not.toContain(COLLECTING);
		expect(html).toContain('stroke="var(--accent)"');
		// First point on the left end, last on the right end (300px wide before it's measured).
		expect(html).toMatch(/d="M0\.0,[\d.]+L150\.0,[\d.]+"/);
		expect(html).toMatch(/d="M150\.0,[\d.]+L300\.0,[\d.]+"/);
		expect(html).toContain(">Today</text>");
	});
});
