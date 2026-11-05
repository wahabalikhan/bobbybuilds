import { describe, expect, it } from "vitest";
import { chartStart, trendFrom } from "@/lib/trend";

const days = (from: string, n: number, value = (i: number) => i + 1) =>
	Array.from({ length: n }, (_, i) => ({ day: new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10), value: value(i) }));

describe("a project chart's start", () => {
	it("is the later of its Started on date and its first tracked visit", () => {
		expect(chartStart("2026-10-31", "2026-11-02")).toBe("2026-11-02");
		expect(chartStart("2026-11-03", "2026-11-02")).toBe("2026-11-03");
		expect(chartStart(null, "2026-11-02")).toBe("2026-11-02");
		expect(chartStart("2026-10-31", null)).toBe("2026-10-31");
		expect(chartStart(null, null)).toBeNull();
	});

	it("is per day for the first four weeks, from the start", () => {
		const trend = trendFrom(days("2026-10-01", 40), "2026-11-05", "2026-11-02");
		expect(trend.period).toBe("day");
		expect(trend.points.map((p) => p.day)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]);
		expect(trend.points[0].value).toBe(33);
	});

	it("is per week (Monday first) from the start's week after that, and the last 12 weeks without a start or for an old one", () => {
		const weekly = trendFrom(days("2026-09-01", 66), "2026-11-05", "2026-09-10");
		expect(weekly.period).toBe("week");
		expect(weekly.points[0].day).toBe("2026-09-07");
		expect(weekly.points.at(-1)!.day).toBe("2026-11-02");
		expect(trendFrom(days("2026-01-01", 309), "2026-11-05", null).points).toHaveLength(12);
		expect(trendFrom(days("2026-01-01", 309), "2026-11-05", "2026-01-05").points).toHaveLength(12);
	});
});
