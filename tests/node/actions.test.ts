import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOGOS } from "@/lib/logos.generated";

/** Every file under src/app/admin that declares server actions. */
function actionFiles(dir = "src/app/admin"): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return actionFiles(path);
		return /\.(ts|tsx)$/.test(name) && /^["']use server["']/m.test(readFileSync(path, "utf8")) ? [path] : [];
	});
}

describe("admin server actions", () => {
	it("are all checked by this test", () => {
		expect(actionFiles()).toContain("src/app/admin/settings/actions.ts");
	});

	it("every exported action checks admin access before doing anything else", () => {
		for (const file of actionFiles()) {
			const source = readFileSync(file, "utf8");
			const actions = [...source.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{\s*([^\n]*)/g)];
			expect(actions.length, file).toBeGreaterThan(0);
			for (const [, name, firstLine] of actions) expect(firstLine.trim(), `${file}: ${name}`).toBe("await requireAdmin();");
			// Nothing else may be exported from a "use server" file (it would be callable from the browser).
			const exported = [...source.matchAll(/^export\s+(?!async function)(\w+)/gm)].map((m) => m[1]);
			expect(exported.filter((e) => e !== "type"), file).toEqual([]);
		}
	});
});

describe("logos", () => {
	it("the generated list matches public/logos/", () => {
		const files = readdirSync("public/logos").filter((n) => /\.(png|jpe?g|webp|svg|gif)$/i.test(n)).sort().map((n) => `/logos/${n}`);
		expect(LOGOS).toEqual(files);
	});
});

/** Every route handler (route.ts) under src/app/admin. */
function routeFiles(dir = "src/app/admin"): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return routeFiles(path);
		return name === "route.ts" ? [path] : [];
	});
}

describe("admin route handlers", () => {
	it("include the first-visit check and the events CSV", () => {
		expect(routeFiles()).toEqual(expect.arrayContaining(["src/app/admin/projects/[slug]/events.csv/route.ts", "src/app/admin/projects/[slug]/first-visit/route.ts"]));
	});

	it("each check admin access before doing anything else", () => {
		for (const file of routeFiles()) {
			const source = readFileSync(file, "utf8");
			const handlers = [...source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\([^)]*\)[^{]*\{\s*([^\n]*)/g)];
			expect(handlers.length, file).toBeGreaterThan(0);
			for (const [, method, firstLine] of handlers) expect(firstLine.trim(), `${file}: ${method}`).toMatch(/^if \(!\(await isAdminRequestFrom\(request\)\)\) return new Response\(/);
		}
	});
});

describe("hidden journey", () => {
	it("the admin journey pages are not found until site.showJourney is true", () => {
		for (const file of ["src/app/admin/settings/journey/page.tsx", "src/app/admin/settings/journey/new/page.tsx", "src/app/admin/settings/journey/[id]/page.tsx"]) {
			expect(readFileSync(file, "utf8"), file).toContain("if (!site.showJourney) return <AdminNotFoundMessage />;");
		}
	});
});
