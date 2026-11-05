import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ColumnChart, niceTicks, RankedList, Sparkline, StatusBadge, TimeSeriesChart, UptimeStrip, uptimeStatus } from "@/components/charts";
import { change, formatChange, formatCount, formatDay, formatDuration, formatMs, msAxis, timeAgo } from "@/lib/format";

const days = (values: (number | null)[]) => values.map((value, i) => ({ day: `2026-10-${String(i + 1).padStart(2, "0")}`, value }));

describe("niceTicks", () => {
	it("picks clean steps", () => {
		expect(niceTicks(97)).toEqual([0, 50, 100]);
		expect(niceTicks(4000)).toEqual([0, 1000, 2000, 3000, 4000]);
		expect(niceTicks(0)).toEqual([0, 1]);
		expect(niceTicks(Number.NaN)).toEqual([0, 1]);
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
		const html = renderToStaticMarkup(<StatusBadge status="critical" />);
		expect(html).toContain("✕");
		expect(html).toContain("Down");
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
