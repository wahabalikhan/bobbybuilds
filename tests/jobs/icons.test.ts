import { describe, expect, it } from "vitest";
import { getIconMeta, iconPath, listIcons, saveIconCheck } from "@/lib/db/icons";
import { cleanSvg, findIcon, iconLinks, sniff } from "@/lib/icons/find";
import { createProject, db } from "../helpers";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const ICO = new Uint8Array([0, 0, 1, 0, 1, 0, 16, 16]);

/** A fake site: path → [status, body, content type]. */
function site(files: Record<string, [number, string | Uint8Array, string?]>) {
	const calls: string[] = [];
	const fn = (async (input: RequestInfo | URL) => {
		const url = String(input);
		calls.push(url);
		const file = files[new URL(url).pathname + new URL(url).search] ?? files[new URL(url).pathname];
		if (!file) return new Response("Not found", { status: 404 });
		return new Response(typeof file[1] === "string" ? file[1] : new Uint8Array(file[1]), { status: file[0], headers: file[2] ? { "Content-Type": file[2] } : {} });
	}) as typeof fetch;
	return { fn, calls };
}

describe("finding a project's icon", () => {
	it("reads link tags, with absolute addresses and sizes", () => {
		const links = iconLinks('<link rel="icon" href="/favicon.ico?v=2" sizes="16x16 32x32"><link rel="apple-touch-icon" href="apple.png" sizes="180x180"><link rel="manifest" href="/m.json">', "https://a.example/page");
		expect(links.map((l) => [l.rel.join(" "), l.href, l.sizes])).toEqual([
			["icon", "https://a.example/favicon.ico?v=2", 32],
			["apple-touch-icon", "https://a.example/apple.png", 180],
			["manifest", "https://a.example/m.json", 0],
		]);
	});

	it("knows real images from their first bytes, and refuses SVGs that could run or load anything", () => {
		expect([sniff(PNG), sniff(ICO), sniff(new TextEncoder().encode(SVG)), sniff(new TextEncoder().encode("<html>"))]).toEqual(["image/png", "image/x-icon", "image/svg+xml", null]);
		expect(cleanSvg(SVG)).toBe(true);
		for (const bad of ['<svg><script>alert(1)</script></svg>', '<svg onload="x()"/>', '<svg><a href="https://evil.example">x</a></svg>', '<svg><image href="https://x.example/a.png"/></svg>', '<svg><foreignObject/></svg>', '<svg style="background:url(https://x.example)"/>']) {
			expect(cleanSvg(bad), bad).toBe(false);
		}
		expect(cleanSvg('<svg><use href="#b"/><rect fill="url(#g)"/></svg>')).toBe(true);
	});

	it("prefers the SVG icon, then the apple-touch-icon, then the manifest's largest, then the favicon", async () => {
		const page = '<link rel="icon" href="/favicon.ico"><link rel="icon" href="/icon.svg?v=2" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple.png"><link rel="manifest" href="/m.webmanifest">';
		const full = { "/": [200, page, "text/html"], "/icon.svg?v=2": [200, SVG, "image/svg+xml"], "/apple.png": [200, PNG, "image/png"], "/m.webmanifest": [200, JSON.stringify({ icons: [{ src: "/i192.png", sizes: "192x192" }, { src: "/i512.png", sizes: "512x512" }] })], "/i512.png": [200, PNG], "/favicon.ico": [200, ICO] } as Record<string, [number, string | Uint8Array, string?]>;
		expect(await findIcon(site(full).fn, "https://a.example/")).toMatchObject({ kind: "svg", contentType: "image/svg+xml", sourceUrl: "https://a.example/icon.svg?v=2" });
		const noSvg = { ...full, "/icon.svg?v=2": [404, ""] } as typeof full;
		expect(await findIcon(site(noSvg).fn, "https://a.example/")).toMatchObject({ kind: "apple-touch-icon", contentType: "image/png" });
		const manifestOnly = { ...noSvg, "/apple.png": [404, ""] } as typeof full;
		expect(await findIcon(site(manifestOnly).fn, "https://a.example/")).toMatchObject({ kind: "manifest", sourceUrl: "https://a.example/i512.png" });
		const faviconOnly = { "/": [200, '<link rel="icon" href="/images/me.png">', "text/html"], "/images/me.png": [200, PNG] } as typeof full;
		expect(await findIcon(site(faviconOnly).fn, "https://a.example/")).toMatchObject({ kind: "favicon", sourceUrl: "https://a.example/images/me.png" });
	});

	it("skips anything that isn't really an image, or an unsafe SVG, and says why when nothing's left", async () => {
		const files = { "/": [200, "<p>hi</p>", "text/html"], "/icon.svg": [200, '<svg onload="x()"/>', "image/svg+xml"], "/favicon.ico": [200, "<html>not an icon</html>", "image/x-icon"] } as Record<string, [number, string | Uint8Array, string?]>;
		expect(await findIcon(site(files).fn, "https://a.example/")).toEqual({ error: "No usable icon on the site." });
		expect(await findIcon(site({}).fn, "https://a.example/")).toEqual({ error: "The site answered 404." });
	});
});

describe("storing a project's icon", () => {
	it("saves a new icon, keeps an unchanged one, replaces a changed one, and keeps it when nothing is found", async () => {
		const projectId = await createProject();
		const found = { data: new TextEncoder().encode(SVG), contentType: "image/svg+xml", kind: "svg" as const, sourceUrl: "https://a.example/icon.svg" };
		expect((await saveIconCheck(db, projectId, found, 1000)).status).toBe("new");
		expect((await saveIconCheck(db, projectId, found, 2000)).status).toBe("same");
		expect(await getIconMeta(db, projectId)).toMatchObject({ changedAt: 1000, checkedAt: 2000, lastError: null });
		const changed = { ...found, data: new TextEncoder().encode(SVG.replace("10", "12")) };
		expect((await saveIconCheck(db, projectId, changed, 3000)).status).toBe("changed");
		expect((await saveIconCheck(db, projectId, { error: "The site answered 503." }, 4000)).status).toBe("none");
		const icon = (await listIcons(db)).get(projectId)!;
		expect(icon).toMatchObject({ changedAt: 3000, checkedAt: 4000, lastError: "The site answered 503.", contentType: "image/svg+xml" });
		expect(new TextDecoder().decode(icon.data)).toContain('viewBox="0 0 12 10"');
		expect(iconPath("tech-jobs", icon)).toMatch(/^\/i\/tech-jobs-[0-9a-f]{12}\.svg$/);
	});
});
