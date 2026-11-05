import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAGE } from "@/lib/layout";

const files = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? files(path) : /\.(tsx?|mjs|mts|md)$/.test(name) ? [path] : [];
	});

describe("one page container, public and admin", () => {
	it("is the public page's width, side padding and centring", () => {
		expect(PAGE).toBe("mx-auto w-full max-w-[1040px] px-5 sm:px-6");
	});

	it("is used by the public page, its footer and header (plain and fading), the 404 page, and the admin top bar and main area", () => {
		for (const file of ["src/app/page.tsx", "src/components/public/footer.tsx", "src/components/public/site-header.tsx", "src/components/public/fading-header.tsx", "src/app/not-found.tsx"]) {
			expect(readFileSync(file, "utf8"), file).toContain("${PAGE}");
		}
		const admin = readFileSync("src/app/admin/layout.tsx", "utf8");
		expect(admin.match(/\$\{PAGE\}/g)?.length, "admin top bar and main").toBe(2);
	});

	it("no page or component sets its own page width (inner content may be narrower, never wider)", () => {
		const offenders = [...files("src/app"), ...files("src/components")].filter((file) => /max-w-(5xl|6xl|7xl|screen|\[1[0-9]{3}px\])/.test(readFileSync(file, "utf8")));
		expect(offenders).toEqual([]);
	});
});

describe("the name", () => {
	it("is BobbyBuilds, one word, in the code, scripts and docs (the domain and identifiers stay lower case)", async () => {
		const { site } = await import("@/lib/site");
		expect(site.name).toBe("BobbyBuilds");
		const sources = [...files("src"), ...files("scripts"), ...files("docs"), "CLAUDE.md", "README.md"].filter((f) => /\.(tsx?|mjs|mts|md)$/.test(f));
		const old = sources.filter((file) => /Bobby\s+Builds/.test(readFileSync(file, "utf8")));
		expect(old).toEqual([]);
	});
});

describe("tab titles", () => {
	it("put the page first and the brand last; the home page is the brand first", async () => {
		const { adminName, homeTitle } = await import("@/lib/site");
		expect(homeTitle).toBe("BobbyBuilds · Wahab (Bobby) Khan");
		expect(adminName).toBe("BobbyBuilds HQ");
		expect(readFileSync("src/app/layout.tsx", "utf8")).toContain("title: { default: homeTitle, template: `%s · ${site.name}` }");
		expect(readFileSync("src/app/admin/layout.tsx", "utf8")).toContain("title: { absolute: adminName, template: `%s · ${adminName}` }");
	});
});

describe("the wordmark", () => {
	it("is the site's name in two halves, both semibold, the second in the accent blue", async () => {
		const { renderToStaticMarkup } = await import("react-dom/server");
		const { createElement } = await import("react");
		const { Wordmark } = await import("@/components/wordmark");
		const { site } = await import("@/lib/site");
		expect(site.wordmark.join("")).toBe(site.name);
		const html = renderToStaticMarkup(createElement(Wordmark));
		expect(html).toContain('<span class="font-semibold text-ink">Bobby</span><span class="font-semibold text-accent">Builds</span>');
		expect(html).not.toMatch(/bg-|15171C/);
	});

	it("reads \"BobbyBuilds HQ\" in the admin, with HQ in muted grey", async () => {
		const { renderToStaticMarkup } = await import("react-dom/server");
		const { createElement } = await import("react");
		const { Wordmark } = await import("@/components/wordmark");
		const html = renderToStaticMarkup(createElement(Wordmark, { suffix: "HQ" }));
		expect(html.replace(/<[^>]+>/g, "")).toBe("BobbyBuilds HQ");
		expect(html).toContain('<span class="font-normal text-muted">HQ</span>');
	});

	it("is monochrome in the public header (plain and fading) and has HQ in the admin top bar", () => {
		expect(readFileSync("src/components/public/site-header.tsx", "utf8")).toMatch(/<Wordmark mono \/>/);
		expect(readFileSync("src/components/public/fading-header.tsx", "utf8")).toMatch(/<Wordmark mono \/>/);
		expect(readFileSync("src/app/admin/layout.tsx", "utf8")).toMatch(/<Wordmark suffix="HQ" \/>/);
	});
});
