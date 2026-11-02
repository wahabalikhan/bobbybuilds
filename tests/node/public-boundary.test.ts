import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
	});
}

/** Public pages and components: everything under src/app except admin, internal, v1 and api. */
const publicFiles = [
	...files("src/app").filter((f) => !/^src\/app\/(admin|internal|v1|api)\//.test(f)),
	...files("src/components/public"),
];

describe("public pages read only the snapshot", () => {
	it("never import database modules or bindings directly", () => {
		expect(publicFiles.length).toBeGreaterThan(5);
		for (const file of publicFiles) {
			const source = readFileSync(file, "utf8");
			expect(source, file).not.toMatch(/from "@\/lib\/db\//);
			expect(source, file).not.toMatch(/getCloudflareContext|from "@\/lib\/jobs\//);
		}
	});

	it("the snapshot reads roll-ups, never raw page views or events", () => {
		const source = readFileSync("src/lib/public/snapshot.ts", "utf8");
		expect(source).not.toMatch(/FROM page_views|FROM events|FROM uptime_checks/);
	});
});
