/**
 * npm run admin:live: the admin dashboard on YOUR machine, reading and writing the LIVE
 * database. Use it until the custom domain and Cloudflare Access are set up.
 * Serves http://127.0.0.1:8788/admin only (loopback). A red LIVE DATA banner shows on every page.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { unstable_readConfig } from "wrangler";
import { adminLiveConfig, adminLiveDevArgs, LIVE_ADMIN_IP, LIVE_ADMIN_PORT } from "./lib/admin-live-config.mjs";

const root = process.cwd();
console.log("Building the app…");
const build = spawnSync("npx", ["opennextjs-cloudflare", "build"], { stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const dir = join(root, ".wrangler", "admin-live");
mkdirSync(dir, { recursive: true });
const configPath = join(dir, "wrangler.json");
writeFileSync(configPath, JSON.stringify(adminLiveConfig(unstable_readConfig({ config: "wrangler.jsonc" }), root), null, 2));

console.log(`
  ⚠  LIVE DATA. Open http://${LIVE_ADMIN_IP}:${LIVE_ADMIN_PORT}/admin (this machine only).
     Anything you change here changes the live site. Press Ctrl+C to stop.
`);
const dev = spawn("npx", adminLiveDevArgs(configPath), { stdio: "inherit" });
const cleanUp = () => rmSync(configPath, { force: true });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => dev.kill(signal));
dev.on("exit", (code) => {
	cleanUp();
	process.exit(code ?? 0);
});
