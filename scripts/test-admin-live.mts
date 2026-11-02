/**
 * npm run test:admin-live: end-to-end check that admin:live can't serve an admin page
 * without the LIVE DATA banner. Builds the app and runs it with exactly the admin:live
 * config, except the database is the LOCAL one (so the test never needs or touches live data).
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { unstable_readConfig } from "wrangler";
import { checkLiveBanner } from "./lib/admin-live-check.mjs";
import { adminLiveConfig, LIVE_ADMIN_IP } from "./lib/admin-live-config.mjs";

const PORT = 8790;
const origin = `http://${LIVE_ADMIN_IP}:${PORT}`;
const root = process.cwd();

if (!process.argv.includes("--no-build")) {
	const build = spawnSync("npx", ["opennextjs-cloudflare", "build"], { stdio: ["ignore", "ignore", "inherit"] });
	if (build.status !== 0) process.exit(build.status ?? 1);
}

const config = adminLiveConfig(unstable_readConfig({ config: "wrangler.jsonc" }), root);
config.d1_databases = config.d1_databases.map((db) => ({ ...db, remote: false }));
config.kv_namespaces = config.kv_namespaces.map((kv: { binding: string; id: string }) => ({ ...kv, remote: false }));
const dir = join(root, ".wrangler", "admin-live-test");
mkdirSync(dir, { recursive: true });
const configPath = join(dir, "wrangler.json");
writeFileSync(configPath, JSON.stringify(config));

const dev = spawn(
	"npx",
	["wrangler", "dev", "--config", configPath, "--ip", LIVE_ADMIN_IP, "--port", String(PORT), "--persist-to", join(root, ".wrangler", "state")],
	{ stdio: "ignore" },
);
const finish = (code: number, message: string) => {
	dev.kill("SIGTERM");
	rmSync(dir, { recursive: true, force: true });
	console[code ? "error" : "log"](message);
	process.exit(code);
};

for (let attempt = 0; ; attempt += 1) {
	try {
		await fetch(`${origin}/admin`);
		break;
	} catch {
		if (attempt > 90) finish(1, "✋ test:admin-live: the server didn't start.");
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
}
const problems = await checkLiveBanner(origin);
if (problems.length) finish(1, `✋ test:admin-live failed:\n${problems.map((p) => `  • ${p}`).join("\n")}`);
finish(0, "✓ test:admin-live: every admin page served with the live config shows the pinned LIVE DATA banner, and its CSS loads.");
