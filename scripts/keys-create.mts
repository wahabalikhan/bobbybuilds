/**
 * Creates (or rotates) a project's keys.
 *
 *   npm run keys:create -- <slug>                 local database
 *   npm run keys:create -- <slug> --remote        live database
 *   npm run keys:create -- <slug> --rotate        new secret key, same public key
 *
 * The secret key is printed once and only its SHA-256 hash is stored. Uses Wrangler's
 * platform proxy so the update goes through prepare().bind(), like every other query.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPlatformProxy, unstable_readConfig } from "wrangler";
import { getProjectBySlug, setProjectKeys } from "../src/lib/db/projects.ts";
import { createPublicKey, createSecretKey, hashSecretKey, secretKeyHint } from "../src/lib/keys.ts";

const args = process.argv.slice(2);
const slug = args.find((arg) => !arg.startsWith("--"));
const remote = args.includes("--remote");
const rotate = args.includes("--rotate");

if (!slug) {
	console.error("Usage: npm run keys:create -- <slug> [--remote] [--rotate]");
	process.exit(1);
}

function remoteConfigPath(): string {
	// A throwaway config in .wrangler/ (ignored by Git) whose D1 binding points at the live database.
	const config = unstable_readConfig({ config: "wrangler.jsonc" });
	const database = config.d1_databases.find((db: { binding: string }) => db.binding === "DB");
	if (!database?.database_id) throw new Error("No DB binding in wrangler.jsonc");
	const dir = join(process.cwd(), ".wrangler", "keys");
	mkdirSync(dir, { recursive: true });
	const path = join(dir, "wrangler.remote.json");
	writeFileSync(
		path,
		JSON.stringify({
			name: config.name,
			compatibility_date: config.compatibility_date,
			d1_databases: [{ binding: "DB", database_name: database.database_name, database_id: database.database_id, remote: true }],
		}),
	);
	return path;
}

const proxy = await getPlatformProxy<{ DB: D1Database }>(
	remote ? { configPath: remoteConfigPath(), envFiles: [] } : { configPath: "wrangler.jsonc", remoteBindings: false, envFiles: [] },
);

try {
	const db = proxy.env.DB;
	const project = await getProjectBySlug(db, slug);
	if (!project) {
		console.error(`No project with slug "${slug}" in the ${remote ? "live" : "local"} database.`);
		process.exitCode = 1;
	} else if (project.secretKeyHint && !rotate) {
		console.error(`"${slug}" already has keys (secret ends …${project.secretKeyHint}). Use --rotate for a new secret key.`);
		process.exitCode = 1;
	} else {
		const publicKey = project.publicKey ?? createPublicKey();
		const secretKey = createSecretKey();
		await setProjectKeys(db, slug, {
			publicKey: project.publicKey ? undefined : publicKey,
			secretKeyHash: await hashSecretKey(secretKey),
			secretKeyHint: secretKeyHint(secretKey),
		});

		console.log(`\nKeys for ${project.name} (${remote ? "live" : "local"} database)\n`);
		console.log(`  Public key:  ${publicKey}   (goes in the t.js snippet; fine to share)`);
		console.log(`  Secret key:  ${secretKey}`);
		console.log("\nCopy the secret key now. It won't be shown again; only its hash is stored.");
		console.log("Put it in the product's own secrets (e.g. `npx wrangler secret put BOBBY_SECRET_KEY`), never in browser code or Git.");
		if (rotate) console.log("The old secret key stopped working just now.");
		console.log("");
	}
} finally {
	await proxy.dispose();
}
