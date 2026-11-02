import { spawnSync } from "node:child_process";
import { unstable_readConfig } from "wrangler";
import { describe, expect, it } from "vitest";
import { adminLiveConfig, adminLiveDevArgs, LIVE_ADMIN_NAME } from "../../scripts/lib/admin-live-config.mjs";
import { site } from "../../src/lib/site";

const base = {
	name: "bobbybuilds",
	main: ".open-next/worker.js",
	compatibility_date: "2026-11-01",
	compatibility_flags: ["nodejs_compat"],
	assets: { binding: "ASSETS", directory: ".open-next/assets" },
	images: { binding: "IMAGES" },
	d1_databases: [{ binding: "DB", database_name: "bobbybuilds-db", database_id: "e9b730ed-b736-4006-b5d8-8059494cb6b7" }],
	ratelimits: [{ name: "PV_LIMITER", namespace_id: "1001", simple: { limit: 60, period: 60 } }],
	kv_namespaces: [{ binding: "PUBLIC_CACHE", id: "d905bda1b9a04f908918cd80b4cbeb64" }],
	routes: [{ pattern: "bobbybuilds.app", custom_domain: true }],
	vars: { ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "" },
};

describe("wrangler.jsonc and site.url", () => {
	const config = unstable_readConfig({ config: "wrangler.jsonc" });

	it("serves only the bare domain, leaving subdomains (techjobs.) free", () => {
		expect(config.routes).toEqual([{ pattern: "bobbybuilds.app", custom_domain: true }]);
		expect(config.workers_dev).toBe(false);
		expect(config.preview_urls).toBe(false);
	});

	it("uses the custom domain as the site's address", () => {
		const url = new URL(site.url);
		expect(url.protocol).toBe("https:");
		expect(url.hostname).toBe(config.routes?.[0] && typeof config.routes[0] === "object" ? config.routes[0].pattern : "");
		expect(site.url).not.toContain("workers.dev");
		expect(site.url).not.toMatch(/\/$/);
	});

	it("keeps search engines out until launch", () => {
		expect(site.indexable).toBe(false);
	});
});

describe("hidden journey and removed project pages", () => {
	it("redirects /p/* to / permanently, and /journey/* to / (temporarily) while the journey is hidden", async () => {
		const { default: config } = await import("../../next.config");
		const redirects = await config.redirects!();
		expect(redirects).toContainEqual({ source: "/p/:path*", destination: "/", permanent: true });
		expect(redirects.some((r) => r.source === "/journey/:path*")).toBe(!site.showJourney);
		expect(redirects.find((r) => r.source === "/journey/:path*")?.permanent).toBe(site.showJourney ? undefined : false);
	});
});

describe("admin:live", () => {
	const config = adminLiveConfig(base, "/repo");

	it("points the database and the public snapshot at the live ones", () => {
		expect(config.d1_databases).toEqual([{ binding: "DB", database_name: "bobbybuilds-db", database_id: base.d1_databases[0].database_id, remote: true }]);
		expect(config.kv_namespaces).toEqual([{ binding: "PUBLIC_CACHE", id: "d905bda1b9a04f908918cd80b4cbeb64", remote: true }]);
		expect(config.main).toBe("/repo/.open-next/worker.js");
		expect(config.assets.directory).toBe("/repo/.open-next/assets");
	});

	it("can never replace the real Worker or be reached from outside this machine", () => {
		expect(config.name).toBe(LIVE_ADMIN_NAME);
		expect(config.name).not.toBe(base.name);
		expect(config.workers_dev).toBe(false);
		expect(config.preview_urls).toBe(false);
		expect(config).not.toHaveProperty("routes");
		expect(adminLiveDevArgs("/tmp/x.json")).toEqual(["wrangler", "dev", "--config", "/tmp/x.json", "--ip", "127.0.0.1", "--port", "8788"]);
	});

	it("opens /admin through the loopback-only local flag and shows the LIVE DATA banner", () => {
		expect(config.vars).toEqual({ ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "", LOCAL_ADMIN_PREVIEW: "on", ADMIN_DATA: "live" });
	});

	it("refuses without a database binding", () => {
		expect(() => adminLiveConfig({ ...base, d1_databases: [] }, "/repo")).toThrow("No DB binding");
	});
});

describe("seed:demo", () => {
	it("refuses to run against the live database", () => {
		for (const flag of ["--remote", "--remote=true"]) {
			const result = spawnSync("node", ["scripts/seed-demo.mts", flag], { encoding: "utf8" });
			expect(result.status).toBe(1);
			expect(result.stderr).toContain("only ever writes to the local database");
		}
	});
});
