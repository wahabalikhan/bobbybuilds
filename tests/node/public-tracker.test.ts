import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
	});
}

const PUBLIC_PAGES = ["src/app/not-found.tsx", "src/app/page.tsx"];

describe("BobbyBuilds' own t.js", () => {
	it("is on the public pages (home and 404) and nowhere else: never the admin or the root layout", () => {
		const users = files("src")
			.filter((f) => /from "@\/components\/public\/tracker"/.test(readFileSync(f, "utf8")))
			.sort();
		expect(users).toEqual(PUBLIC_PAGES);
		for (const file of PUBLIC_PAGES) expect(readFileSync(file, "utf8"), file).toMatch(/<PublicTracker \/>/);
		for (const file of files("src/app/admin")) expect(readFileSync(file, "utf8"), file).not.toMatch(/PublicTracker|trackerKey/);
		expect(readFileSync("src/app/layout.tsx", "utf8")).not.toMatch(/PublicTracker|t\.js/);
	});

	it("loads from the same origin, which the public CSP already allows", () => {
		expect(readFileSync("src/components/public/tracker.tsx", "utf8")).toMatch(/src="\/t\.js" data-key=\{site\.trackerKey\}/);
		const headers = readFileSync("src/lib/security/headers.ts", "utf8");
		expect(headers).toMatch(/script-src 'self'/);
		expect(headers).toMatch(/connect-src 'self'/);
	});

	it("the 404 page is marked, so t.js sends not_found", () => {
		expect(readFileSync("src/app/not-found.tsx", "utf8")).toMatch(/data-bobby-not-found/);
	});
});
