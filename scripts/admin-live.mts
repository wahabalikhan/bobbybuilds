/**
 * npm run admin:live: the admin dashboard on YOUR machine, reading and writing the LIVE
 * database. Use it until the custom domain and Cloudflare Access are set up.
 * Serves http://127.0.0.1:8788/admin only (loopback). A red LIVE DATA banner is pinned to
 * the top of every admin page; if a page ever comes back without it, this shuts down.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { unstable_readConfig } from "wrangler";
import { checkLiveBanner } from "./lib/admin-live-check.mjs";
import { adminLiveConfig, adminLiveDevArgs, LIVE_ADMIN_IP, LIVE_ADMIN_PORT } from "./lib/admin-live-config.mjs";

const root = process.cwd();
const origin = `http://${LIVE_ADMIN_IP}:${LIVE_ADMIN_PORT}`;
console.log("Building the app…");
const build = spawnSync("npx", ["opennextjs-cloudflare", "build"], { stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const dir = join(root, ".wrangler", "admin-live");
mkdirSync(dir, { recursive: true });
const configPath = join(dir, "wrangler.json");
writeFileSync(configPath, JSON.stringify(adminLiveConfig(unstable_readConfig({ config: "wrangler.jsonc" }), root), null, 2));

const dev = spawn("npx", adminLiveDevArgs(configPath), { stdio: ["ignore", "pipe", "inherit"] });
dev.stdout.pipe(process.stdout);
const stop = (code: number) => {
	dev.kill("SIGTERM");
	rmSync(configPath, { force: true });
	process.exit(code);
};
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => stop(0));
dev.on("exit", (code) => {
	rmSync(configPath, { force: true });
	process.exit(code ?? 0);
});

// Wait for the server, then check the banner on real pages before telling you it's ready.
for (let attempt = 0; ; attempt += 1) {
	try {
		await fetch(`${origin}/admin`);
		break;
	} catch {
		if (attempt > 120) stop(1);
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
}
const problems = await checkLiveBanner(origin);
if (problems.length) {
	console.error("\n✋ Stopped: the LIVE DATA banner check failed, so admin:live won't run.\n");
	for (const problem of problems) console.error(`  • ${problem}`);
	stop(1);
}
console.log(`
  ⚠  LIVE DATA. Open ${origin}/admin (this machine only).
     Banner check passed. Anything you change here changes the live site. Press Ctrl+C to stop.
`);
