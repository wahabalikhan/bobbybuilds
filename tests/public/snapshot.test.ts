import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { runTask } from "@/lib/jobs/run";
import { rollupDay } from "@/lib/jobs/rollup";
import { buildSnapshot, excerpt, publishSnapshot, readSnapshot, SNAPSHOT_KEY } from "@/lib/public/snapshot";
import { createProject, db, insert, validPageView } from "../helpers";

const TODAY = "2026-11-02";
const NOW = Date.UTC(2026, 10, 2, 12);
const visitor = (n: number) => n.toString(16).padStart(64, "0");

async function project(slug: string, { visitorsPublic = true, status = "live" } = {}) {
	const id = await createProject({ slug, name: slug, status, tagline: `${slug} tagline`, description_md: "Hello <script>alert(1)</script> **world**" });
	await insert("metrics", { project_id: id, key: "visitors", label: "Visitors", source: "collector", is_public: visitorsPublic ? 1 : 0, is_headline: visitorsPublic ? 1 : 0 });
	for (const [day, n] of [[TODAY, 3], ["2026-10-30", 2]] as const) {
		for (let i = 0; i < n; i += 1) await insert("page_views", validPageView(id, { day, ts: Date.parse(`${day}T10:00:00Z`) + i, visitor_id: visitor(i + 1) }));
		await rollupDay(db, day);
	}
	return id;
}

/** A KV wrapper that counts writes. */
function countingKv() {
	let puts = 0;
	const kv = new Proxy(env.PUBLIC_CACHE, {
		get(target, prop) {
			if (prop === "put") return (...args: Parameters<KVNamespace["put"]>) => ((puts += 1), target.put(...args));
			const value = Reflect.get(target, prop);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
	return { kv, puts: () => puts };
}

describe("public snapshot", () => {
	it("contains public numbers only", async () => {
		const id = await project("pub-numbers");
		await insert("metrics", { project_id: id, key: "secret_revenue", label: "Revenue", source: "product", is_public: 0 });
		const secret = await db.prepare("SELECT id FROM metrics WHERE project_id = ?1 AND key = 'secret_revenue'").bind(id).first<{ id: number }>();
		await insert("metric_values", { metric_id: secret!.id, day: TODAY, value: 987654 });
		await insert("metrics", { project_id: id, key: "jobs", label: "Jobs listed", unit: "jobs", source: "product", is_public: 1 });
		const jobs = await db.prepare("SELECT id FROM metrics WHERE project_id = ?1 AND key = 'jobs'").bind(id).first<{ id: number }>();
		await insert("metric_values", { metric_id: jobs!.id, day: "2026-11-01", value: 42 });

		const snapshot = await buildSnapshot(db, TODAY, NOW);
		const p = snapshot.projects.find((x) => x.slug === "pub-numbers")!;
		expect(p.numbers.map((n) => n.key)).toEqual(["visitors", "jobs"]);
		expect(p.numbers[1]).toMatchObject({ figure: 42, kind: "latest", seriesKind: "daily" });
		expect(p.numbers[1].series).toHaveLength(90);
		expect(p.numbers[0]).toMatchObject({ figure: 5, kind: "count", seriesKind: "weekly" });
		expect(p.pill).toEqual({ label: "Visitors", unit: "", value: 5, period: "last 30 days" });
		expect(JSON.stringify(snapshot)).not.toContain("987654");
		expect(JSON.stringify(snapshot)).not.toContain("secret_revenue");
	});

	it("leaves a project's visitors out everywhere when they're private", async () => {
		await project("pub-private-visitors", { visitorsPublic: false });
		const snapshot = await buildSnapshot(db, TODAY, NOW);
		const p = snapshot.projects.find((x) => x.slug === "pub-private-visitors")!;
		expect(p).toMatchObject({ weekly: null, monthly: null, pill: null, numbers: [] });

		const before = snapshot.monthly.at(-1)!.value;
		await project("pub-public-visitors");
		const after = (await buildSnapshot(db, TODAY, NOW)).monthly.at(-1)!.value;
		expect(after - before).toBe(3); // only the public project's November visitors (3 of its 5) were added
	});

	it("builds 12 weeks with this week last, and 12 months with this month last", async () => {
		await project("pub-series");
		const p = (await buildSnapshot(db, TODAY, NOW)).projects.find((x) => x.slug === "pub-series")!;
		expect(p.weekly).toHaveLength(12);
		expect(p.weekly!.at(-1)).toEqual({ day: "2026-11-02", value: 3 });
		expect(p.weekly!.at(-2)).toEqual({ day: "2026-10-26", value: 2 });
		expect(p.monthly).toHaveLength(12);
		expect(p.monthly!.at(-1)).toEqual({ month: "2026-11", value: 3 });
	});

	it("sanitises descriptions and journey entries", async () => {
		await project("pub-markdown");
		const p = (await buildSnapshot(db, TODAY, NOW)).projects.find((x) => x.slug === "pub-markdown")!;
		expect(p.descriptionHtml).toContain("&lt;script&gt;");
		expect(p.descriptionHtml).not.toContain("<script");
		expect(p.descriptionHtml).toContain("<strong>world</strong>");
	});

	it("only has published, already-dated journey entries and public milestones", async () => {
		const id = await project("pub-journey");
		await insert("journey_entries", { slug: "pub-published", title: "Published", body_md: "First paragraph.\n\n## Heading\n\nMore.", project_id: id, is_published: 1, published_at: NOW - 86_400_000 });
		await insert("journey_entries", { slug: "pub-draft", title: "Draft", body_md: "secret draft", is_published: 0 });
		await insert("journey_entries", { slug: "pub-future", title: "Future", body_md: "not yet", is_published: 1, published_at: NOW + 86_400_000 });
		await insert("milestones", { project_id: id, day: "2026-10-01", title: "Public milestone", is_public: 1 });
		await insert("milestones", { project_id: id, day: "2026-10-02", title: "Private milestone", is_public: 0 });

		const snapshot = await buildSnapshot(db, TODAY, NOW);
		const slugs = snapshot.journey.map((e) => e.slug);
		expect(slugs).toContain("pub-published");
		expect(slugs).not.toContain("pub-draft");
		expect(slugs).not.toContain("pub-future");
		expect(snapshot.journey.find((e) => e.slug === "pub-published")).toMatchObject({ projectSlug: "pub-journey", excerpt: "First paragraph." });
		expect(snapshot.projects.find((p) => p.slug === "pub-journey")!.milestones).toEqual([{ day: "2026-10-01", title: "Public milestone", note: "" }]);
		expect(JSON.stringify(snapshot)).not.toContain("Private milestone");
		expect(JSON.stringify(snapshot)).not.toContain("secret draft");
	});

	it("writes to KV only when something changed", async () => {
		await project("pub-writes");
		const { kv, puts } = countingKv();
		expect((await publishSnapshot(db, kv, TODAY, NOW)).written).toBe(true);
		expect((await publishSnapshot(db, kv, TODAY, NOW + 600_000)).written).toBe(false); // only the build time differs
		expect(puts()).toBe(1);

		await insert("page_views", validPageView((await db.prepare("SELECT id FROM projects WHERE slug = 'pub-writes'").first<{ id: number }>())!.id, { day: TODAY, ts: NOW, visitor_id: visitor(99) }));
		await rollupDay(db, TODAY);
		expect((await publishSnapshot(db, kv, TODAY, NOW + 1_200_000)).written).toBe(true);
		expect(puts()).toBe(2);
	});

	it("builds and stores the snapshot on the first read", async () => {
		await env.PUBLIC_CACHE.delete(SNAPSHOT_KEY);
		await project("pub-first-read");
		const snapshot = await readSnapshot(env.PUBLIC_CACHE, db, TODAY);
		expect(snapshot.projects.some((p) => p.slug === "pub-first-read")).toBe(true);
		expect(await env.PUBLIC_CACHE.get(SNAPSHOT_KEY)).not.toBeNull();
	});

	it("is refreshed by the 5-minute job every 10 minutes", async () => {
		const deps = { db, fetch: (async () => new Response("[]")) as typeof fetch, kv: env.PUBLIC_CACHE };
		const tenth = await runTask("frequent", deps, Date.UTC(2026, 10, 2, 9, 30));
		const fifth = await runTask("frequent", deps, Date.UTC(2026, 10, 2, 9, 35));
		expect(tenth.summary).toHaveProperty("snapshot");
		expect(fifth.summary).not.toHaveProperty("snapshot");
	});
});

describe("excerpt", () => {
	it("uses the first paragraph, skipping headings and lists", () => {
		expect(excerpt("# Title\n\nThe **first** [paragraph](https://x.example).\n\n- a\n- b")).toBe("The first paragraph.");
		expect(excerpt("- only a list")).toBe("");
		expect(excerpt("a ".repeat(200)).length).toBeLessThanOrEqual(180);
	});
});
