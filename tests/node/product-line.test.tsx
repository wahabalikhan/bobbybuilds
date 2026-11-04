import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectCard } from "@/components/public/project-card";
import { fillTagline, fillTaglineParts, productLine, RECENT_DAYS, taglineKeys } from "@/lib/public/product-line";
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

	it("shows the numbers in bold on the public card, and only the numbers", () => {
		const project = {
			slug: "tech-jobs",
			name: "Tech Jobs",
			tagline: "4,868 real tech jobs, straight from 838 companies",
			taglineParts: fillTaglineParts(TEMPLATE, FALLBACK, [k("open_jobs", 4868, "2026-11-04"), k("active_companies", 838, "2026-11-04")], "2026-11-04"),
			status: "building",
			siteUrl: "https://techjobs.bobbybuilds.app",
			logoPath: null,
			weekly: null,
		} as unknown as PublicProject;
		const html = renderToStaticMarkup(<ProjectCard project={project} />);
		expect([...html.matchAll(/<strong[^>]*>([^<]*)<\/strong>/g)].map((m) => m[1])).toEqual(["4,868", "838"]);
		expect(html).toContain('title="4,868 real tech jobs, straight from 838 companies"');
	});

	it("leaves a tagline without placeholders as it is", () => {
		expect(fillTagline("Product design case studies.", "", [], "2026-11-04")).toBe("Product design case studies.");
	});
});
