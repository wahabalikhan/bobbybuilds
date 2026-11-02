import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Tests run inside the Workers runtime against a fresh local D1 with every migration applied.
export default defineConfig(async () => {
	const migrations = await readD1Migrations(fileURLToPath(new URL("./migrations", import.meta.url)));
	return {
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
		resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
		test: {
			include: ["tests/**/*.test.ts"],
			setupFiles: ["./tests/apply-migrations.ts"],
		},
	};
});
