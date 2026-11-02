import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { adminLiveConfig, adminLiveDevArgs, LIVE_ADMIN_NAME } from "../../scripts/lib/admin-live-config.mjs";

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
	vars: { ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "" },
};

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
