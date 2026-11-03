import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAGE } from "@/lib/layout";

const files = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
	});

describe("one page container, public and admin", () => {
	it("is the public page's width, side padding and centring", () => {
		expect(PAGE).toBe("mx-auto w-full max-w-[1040px] px-5 sm:px-6");
	});

	it("is used by the public page, its footer and slim header, the 404 page, and the admin top bar and main area", () => {
		for (const file of ["src/app/page.tsx", "src/components/public/footer.tsx", "src/components/public/site-header.tsx", "src/app/not-found.tsx", "src/app/journey/page.tsx", "src/app/journey/[slug]/page.tsx"]) {
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
