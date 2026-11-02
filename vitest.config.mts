import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

// Two projects:
// - workers: runs inside the Workers runtime against a fresh local D1 with every migration applied
// - tracker: t.js logic in Node, against happy-dom browser windows
export default defineConfig(async () => {
	const migrations = await readD1Migrations(fileURLToPath(new URL("./migrations", import.meta.url)));
	return {
		test: {
			projects: [
				{
					plugins: [
						cloudflareTest({
							miniflare: {
								compatibilityDate: "2026-11-01",
								compatibilityFlags: ["nodejs_compat"],
								d1Databases: ["DB"],
								bindings: { TEST_MIGRATIONS: migrations },
							},
						}),
					],
					resolve: { alias },
					test: {
						name: "workers",
						include: ["tests/**/*.test.ts"],
						exclude: ["tests/tracker/**"],
						setupFiles: ["./tests/apply-migrations.ts"],
					},
				},
				{
					resolve: { alias },
					test: { name: "tracker", include: ["tests/tracker/**/*.test.ts"], environment: "node" },
				},
			],
		},
	};
});
