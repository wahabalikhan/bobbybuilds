import { describe, expect, it } from "vitest";
import { productLine, RECENT_DAYS } from "@/lib/public/product-line";

const n = (label: string, figure: number | null, latestDay: string | null, kind: "latest" | "count" = "latest") => ({ kind, label, figure, latestDay });

describe("the public card's product numbers line", () => {
	it("joins the latest values with commas and a dot, labels in lower case", () => {
		expect(productLine([n("Open jobs", 4059, "2026-11-02"), n("Companies", 270, "2026-11-01")], "2026-11-02")).toBe("4,059 open jobs · 270 companies");
	});

	it("leaves out values older than a week, and counts that aren't product numbers", () => {
		expect(RECENT_DAYS).toBe(7);
		expect(productLine([n("Open jobs", 10, "2026-10-26"), n("Companies", 5, "2026-10-25")], "2026-11-02")).toBe("10 open jobs");
		expect(productLine([n("Visitors", 500, null, "count")], "2026-11-02")).toBeNull();
	});

	it("is hidden when there's nothing recent", () => {
		expect(productLine([], "2026-11-02")).toBeNull();
		expect(productLine([n("Open jobs", null, null), n("Companies", 3, "2026-10-01")], "2026-11-02")).toBeNull();
	});
});
