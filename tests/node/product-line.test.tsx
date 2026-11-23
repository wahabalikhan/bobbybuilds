import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FeaturedProjectCard } from "@/components/public/home";
import { fillTagline, fillTaglineParts, fillText, productLine, RECENT_DAYS, taglineKeys } from "@/lib/public/product-line";
import type { PublicProject } from "@/lib/public/snapshot";

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

describe("taglines with numbers", () => {
	const TEMPLATE = "{open_jobs} real tech jobs, straight from {active_companies} companies";
	const FALLBACK = "Only real tech jobs, straight from the company";
	const k = (key: string, figure: number | null, latestDay: string | null, kind: "latest" | "count" = "latest") => ({ key, kind, figure, latestDay });

	it("fills each {key} with the latest value, with commas", () => {
		expect(taglineKeys(TEMPLATE)).toEqual(["open_jobs", "active_companies"]);
		expect(fillTagline(TEMPLATE, FALLBACK, [k("open_jobs", 4868, "2026-11-04"), k("active_companies", 838, "2026-11-03")], "2026-11-04")).toBe("4,868 real tech jobs, straight from 838 companies");
	});

	it("shows the fallback when either value is over a week old, missing, or not a product number", () => {
		const fresh = k("open_jobs", 4868, "2026-11-04");
		expect(fillTagline(TEMPLATE, FALLBACK, [fresh, k("active_companies", 838, "2026-10-27")], "2026-11-04")).toBe(FALLBACK);
		expect(fillTagline(TEMPLATE, FALLBACK, [fresh, k("active_companies", 838, "2026-10-28")], "2026-11-04")).toBe("4,868 real tech jobs, straight from 838 companies");
		expect(fillTagline(TEMPLATE, FALLBACK, [fresh], "2026-11-04")).toBe(FALLBACK);
		expect(fillTagline(TEMPLATE, FALLBACK, [fresh, k("active_companies", null, null)], "2026-11-04")).toBe(FALLBACK);
		expect(fillTagline(TEMPLATE, FALLBACK, [fresh, k("active_companies", 838, null, "count")], "2026-11-04")).toBe(FALLBACK);
	});

	it("marks the filled-in numbers, so the card can show them in bold", () => {
		const parts = fillTaglineParts(TEMPLATE, FALLBACK, [k("open_jobs", 4868, "2026-11-04"), k("active_companies", 838, "2026-11-04")], "2026-11-04");
		expect(parts).toEqual([{ text: "4,868", number: true }, { text: " real tech jobs, straight from " }, { text: "838", number: true }, { text: " companies" }]);
		expect(fillTaglineParts(TEMPLATE, FALLBACK, [], "2026-11-04")).toEqual([{ text: FALLBACK }]);
		expect(fillTaglineParts(TEMPLATE, "", [], "2026-11-04")).toEqual([]);
	});

	it("the featured card shows the tagline without numbers, then the recent numbers in large figures", () => {
		const project = {
			slug: "realtechjobs",
			name: "RealTechJobs",
			pitch: FALLBACK,
			status: "live",
			up: true,
			siteUrl: "https://realtechjobs.co.uk",
			screenshot: null,
			numbers: [
				{ key: "open_jobs", label: "Open jobs", kind: "latest", figure: 4868, latestDay: "2026-11-04" },
				{ key: "active_companies", label: "Companies", kind: "latest", figure: 838, latestDay: "2026-11-04" },
				{ key: "visitors", label: "Visitors", kind: "count", figure: 50, latestDay: null },
			],
		} as unknown as PublicProject;
		const text = renderToStaticMarkup(<FeaturedProjectCard project={project} number={2} today="2026-11-04" className="" />).replace(/<[^>]+>/g, "|");
		expect(text).toContain(FALLBACK);
		expect(text).toMatch(/\|4,868\|/);
		expect(text).toMatch(/\|open jobs\|/);
		expect(text).toMatch(/\|838\|/);
		expect(text).not.toContain("50");
		// Over a week old: left out.
		const stale = renderToStaticMarkup(<FeaturedProjectCard project={project} number={2} today={`2026-11-${String(4 + RECENT_DAYS + 1).padStart(2, "0")}`} className="" />);
		expect(stale).not.toContain("4,868");
	});

	it("leaves a tagline without placeholders as it is", () => {
		expect(fillTagline("Product design case studies.", "", [], "2026-11-04")).toBe("Product design case studies.");
	});
});

describe("journey posts' {numbers}", () => {
	const numbers = [{ key: "open_jobs", kind: "latest" as const, figure: 2103, latestDay: "2026-11-20" }];
	it("fills a live number, with commas", () => {
		expect(fillText("Today it lists {open_jobs} jobs.", numbers, "2026-11-23")).toBe("Today it lists 2,103 jobs.");
	});
	it("leaves text without numbers as it is", () => {
		expect(fillText("~5,000", numbers, "2026-11-23")).toBe("~5,000");
	});
	it("is null when a number can't be filled (unknown, or over a week old), so it's left out", () => {
		expect(fillText("{companies} companies", numbers, "2026-11-23")).toBeNull();
		expect(fillText("{open_jobs} jobs", numbers, "2026-12-30")).toBeNull();
	});
});

