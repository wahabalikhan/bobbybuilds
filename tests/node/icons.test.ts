import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("the icon set", () => {
	const layout = readFileSync("src/app/layout.tsx", "utf8");
	const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8")) as { short_name: string; icons: { src: string; purpose: string }[] };
	const file = (url: string) => `public${url.split("?")[0]}`;

	it("points only at files that exist, every one versioned so browsers fetch the new icons", () => {
		const urls = [...layout.matchAll(/url: "([^"]+)"/g), ...layout.matchAll(/manifest: "([^"]+)"/g)].map((m) => m[1]);
		expect(urls.length).toBeGreaterThanOrEqual(4);
		for (const url of [...urls, ...manifest.icons.map((i) => i.src)]) {
			expect(url, url).toMatch(/\?v=\d+$/);
			expect(existsSync(file(url)), url).toBe(true);
		}
	});

	it("has a maskable icon for Android and the short name BobbyBuilds", () => {
		expect(manifest.short_name).toBe("BobbyBuilds");
		expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
	});

	it("never serves the old dark-square favicon", () => {
		expect(existsSync("public/favicon.svg")).toBe(false);
		expect(layout).not.toContain("favicon.svg");
	});
});
