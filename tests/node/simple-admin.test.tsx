import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { statusText, statusTone } from "@/components/admin/status-menu";
import { ProjectLogo } from "@/components/admin/ui";
import { SiteFooter } from "@/components/public/footer";
import { sourceName } from "@/lib/admin/sources";
import { logoFor } from "@/lib/project-logo";

describe("sources in plain words", () => {
	it("names well-known referrers and utm_source values", () => {
		expect(sourceName("www.linkedin.com")).toBe("LinkedIn");
		expect(sourceName("lnkd.in")).toBe("LinkedIn");
		expect(sourceName("linkedin")).toBe("LinkedIn");
		expect(sourceName("www.google.co.uk")).toBe("Google");
		expect(sourceName("t.co")).toBe("X (Twitter)");
		expect(sourceName("news.ycombinator.com")).toBe("Hacker News");
		expect(sourceName("chatgpt.com")).toBe("ChatGPT");
		expect(sourceName("")).toBe("Direct or unknown");
		expect(sourceName("www.some-blog.dev")).toBe("some-blog.dev");
	});
});

describe("the top bar's status pill", () => {
	const item = (level: "critical" | "serious" | "warning") => ({ level, message: "x" });
	it("is green and quiet when all is well", () => {
		expect(statusText([])).toBe("Everything's running normally");
		expect(statusTone([])).toBe("good");
	});
	it("counts what needs attention: amber for a check, red when something's down or failed", () => {
		expect(statusText([item("warning")])).toBe("1 thing needs attention");
		expect(statusText([item("warning"), item("warning"), item("critical")])).toBe("3 things need attention");
		expect(statusTone([item("warning")])).toBe("warning");
		expect(statusTone([item("warning"), item("serious")])).toBe("critical");
		expect(statusTone([item("critical")])).toBe("critical");
	});
});

describe("project icons", () => {
	it("come automatically from public/logos/<slug>.*", () => {
		expect(logoFor({ slug: "portfolio", logoPath: null })).toBe("/logos/portfolio.png");
		expect(logoFor({ slug: "tech-jobs", logoPath: "/logos/old.png" })).toBe("/logos/tech-jobs.svg");
		expect(logoFor({ slug: "no-file-yet", logoPath: null })).toBeNull();
	});

	it("keep their own shape: no background, border, outline or rounded clipping, fitted with object-fit: contain", () => {
		const html = renderToStaticMarkup(<ProjectLogo name="Portfolio" logoPath="/logos/portfolio.png" size={28} />);
		expect(html).toContain("object-contain");
		expect(html).toMatch(/width:28px;height:28px/);
		expect(html).not.toMatch(/rounded|ring-|border|bg-|object-cover/);
	});

	it("the footer's tool icons too", () => {
		const html = renderToStaticMarkup(<SiteFooter year={2026} />);
		const imgs = [...html.matchAll(/<img [^>]*>/g)].map((m) => m[0]);
		expect(imgs.length).toBeGreaterThanOrEqual(6);
		for (const img of imgs) {
			expect(img).toContain("object-contain");
			expect(img).not.toMatch(/rounded|ring-|object-cover/);
		}
	});

	it("Portfolio's is the circle photo with a see-through background, and the square original is kept", () => {
		const png = readFileSync("public/logos/portfolio.png");
		expect(png.readUInt32BE(16)).toBe(png.readUInt32BE(20)); // square canvas
		expect(png[25]).toBe(6); // colour type 6: RGBA, so the corners can be transparent
		expect(() => readFileSync("public/logos/originals/portfolio-square.png")).not.toThrow();
	});
});
