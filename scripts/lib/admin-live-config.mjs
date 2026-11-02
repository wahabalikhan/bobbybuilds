/**
 * Builds the throwaway Wrangler config for `npm run admin:live`: the local preview of the
 * built app, with the D1 binding pointed at the LIVE database. Kept separate (and pure) so
 * tests can check its safety settings.
 *
 * Safety:
 * - It only ever runs with `wrangler dev`, bound to 127.0.0.1, so nothing else on your
 *   network can reach it.
 * - /admin is opened by LOCAL_ADMIN_PREVIEW, which the middleware honours on loopback
 *   hostnames only. Even if this config were deployed, the live hostname would get 403.
 * - Its own Worker name, so it can never overwrite the real Worker; no workers.dev, no
 *   preview URLs, no routes.
 */
import { resolve } from "node:path";

export const LIVE_ADMIN_NAME = "bobbybuilds-admin-live";
export const LIVE_ADMIN_PORT = 8788;
export const LIVE_ADMIN_IP = "127.0.0.1";

/** @param {Record<string, any>} base the parsed wrangler.jsonc  @param {string} root project root */
export function adminLiveConfig(base, root) {
	const database = (base.d1_databases ?? []).find((db) => db.binding === "DB");
	if (!database?.database_id) throw new Error("No DB binding in wrangler.jsonc");
	return {
		name: LIVE_ADMIN_NAME,
		main: resolve(root, base.main),
		compatibility_date: base.compatibility_date,
		compatibility_flags: base.compatibility_flags ?? [],
		assets: { ...base.assets, directory: resolve(root, base.assets.directory) },
		images: base.images,
		services: [{ binding: "WORKER_SELF_REFERENCE", service: LIVE_ADMIN_NAME }],
		d1_databases: [{ binding: "DB", database_name: database.database_name, database_id: database.database_id, remote: true }],
		ratelimits: base.ratelimits ?? [],
		workers_dev: false,
		preview_urls: false,
		vars: {
			ACCESS_TEAM_DOMAIN: "",
			ACCESS_AUD: "",
			LOCAL_ADMIN_PREVIEW: "on",
			ADMIN_DATA: "live",
		},
	};
}

/** Arguments for `wrangler dev`: loopback only, fixed port. */
export function adminLiveDevArgs(configPath) {
	return ["wrangler", "dev", "--config", configPath, "--ip", LIVE_ADMIN_IP, "--port", String(LIVE_ADMIN_PORT)];
}
