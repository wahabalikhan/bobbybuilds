#!/usr/bin/env node
/**
 * Refuses to build or deploy if a secret could leak.
 *
 * Next.js reads .env files at build time and can bake their values into the bundle,
 * and NEXT_PUBLIC_ values are sent to every browser. So secrets must only live in
 * .dev.vars (local, ignored by Git) or Wrangler secrets (production).
 *
 * Checks:
 * 1. No .env file (other than .env.example) holds a secret-looking value.
 * 2. No NEXT_PUBLIC_ variable anywhere has a secret-looking name.
 * 3. .dev.vars.example and .env.example hold names only, no values.
 * 4. wrangler.jsonc "vars" (which are committed) hold no secret-looking names.
 * 5. .dev.vars and .env files are ignored by Git and not tracked.
 * 6. The local-only admin flag (LOCAL_ADMIN_PREVIEW) lives only in .dev.vars: never in a
 *    .env file (OpenNext would bake it into the bundle) or wrangler.jsonc. With --deploy,
 *    also checks it isn't one of the Worker's deployed secrets.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const SECRET_NAME = /(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|API_?KEY|_KEY$|^KEY$|SALT|PEPPER|SIGNING|DSN|DATABASE_URL|WEBHOOK)/i;

const problems = [];

function parseEnv(text) {
	const entries = [];
	for (const [index, raw] of text.split(/\r?\n/).entries()) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
		if (!match) continue;
		const value = match[2].replace(/\s+#.*$/, "").replace(/^(['"])(.*)\1$/, "$2").trim();
		entries.push({ name: match[1], value, line: index + 1 });
	}
	return entries;
}

const envFiles = readdirSync(root).filter((name) => /^\.env(\..+)?$/.test(name));

// 1 and 2: .env files
for (const file of envFiles) {
	if (file === ".env.example") continue;
	for (const { name, value, line } of parseEnv(readFileSync(join(root, file), "utf8"))) {
		if (name.startsWith("NEXT_PUBLIC_") && SECRET_NAME.test(name)) {
			problems.push(`${file}:${line} ${name} looks secret but NEXT_PUBLIC_ sends it to every browser.`);
		} else if (value && SECRET_NAME.test(name)) {
			problems.push(`${file}:${line} ${name} looks like a secret. Move it to .dev.vars or \`wrangler secret put ${name}\`.`);
		}
	}
}

// 2: NEXT_PUBLIC_ secrets in .dev.vars too
if (existsSync(join(root, ".dev.vars"))) {
	for (const { name, line } of parseEnv(readFileSync(join(root, ".dev.vars"), "utf8"))) {
		if (name.startsWith("NEXT_PUBLIC_") && SECRET_NAME.test(name)) {
			problems.push(`.dev.vars:${line} ${name} looks secret but NEXT_PUBLIC_ sends it to every browser.`);
		}
	}
}

// 3: example files are names only
for (const file of [".dev.vars.example", ".env.example"]) {
	if (!existsSync(join(root, file))) continue;
	for (const { name, value, line } of parseEnv(readFileSync(join(root, file), "utf8"))) {
		if (value) problems.push(`${file}:${line} ${name} has a value. Example files hold names only.`);
	}
}

// 4: committed Wrangler vars
const wranglerPath = join(root, "wrangler.jsonc");
if (existsSync(wranglerPath)) {
	const text = readFileSync(wranglerPath, "utf8");
	const varsBlock = text.match(/"vars"\s*:\s*\{([\s\S]*?)\}/);
	if (varsBlock) {
		for (const [, name] of varsBlock[1].matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"\s*:/g)) {
			if (SECRET_NAME.test(name)) {
				problems.push(`wrangler.jsonc vars.${name} looks like a secret. Use \`wrangler secret put ${name}\` instead.`);
			}
		}
	}
}

// 5: Git hygiene
/** Returns { status, stdout }; status is Git's exit code (-1 if Git couldn't run). */
function git(args) {
	try {
		const stdout = execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
		return { status: 0, stdout };
	} catch (error) {
		return { status: typeof error.status === "number" ? error.status : -1, stdout: "" };
	}
}

if (git(["rev-parse", "--is-inside-work-tree"]).status === 0) {
	for (const file of [".dev.vars", ".env", ".env.local", ".env.production"]) {
		// check-ignore exits 0 when the path is ignored, 1 when it isn't.
		if (git(["check-ignore", "-q", "--no-index", file]).status !== 0) {
			problems.push(`${file} is not ignored by Git. Add it to .gitignore.`);
		}
	}
	const tracked = git(["ls-files"]).stdout.split("\n").filter((path) => {
		const name = path.split("/").pop() ?? "";
		return (/^\.env(\..+)?$/.test(name) && name !== ".env.example") || (/^\.dev\.vars/.test(name) && name !== ".dev.vars.example");
	});
	for (const path of tracked) problems.push(`${path} is committed to Git. Remove it with \`git rm --cached ${path}\` and rotate any secrets in it.`);
}

// 6: the local-only admin flag
const LOCAL_ADMIN_FLAG = "LOCAL_ADMIN_PREVIEW";
for (const file of envFiles) {
	if (readFileSync(join(root, file), "utf8").includes(LOCAL_ADMIN_FLAG)) {
		problems.push(`${file} mentions ${LOCAL_ADMIN_FLAG}. It belongs only in .dev.vars, or it could ship in the build.`);
	}
}
if (existsSync(wranglerPath) && readFileSync(wranglerPath, "utf8").includes(LOCAL_ADMIN_FLAG)) {
	problems.push(`wrangler.jsonc mentions ${LOCAL_ADMIN_FLAG}. It belongs only in .dev.vars.`);
}
if (process.argv.includes("--deploy")) {
	let secrets = null;
	try {
		const out = execFileSync("npx", ["wrangler", "secret", "list", "--format", "json"], {
			cwd: root,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		});
		secrets = JSON.parse(out.slice(out.indexOf("[")));
	} catch {
		problems.push("Couldn't read the Worker's secrets with `wrangler secret list`. Check you're online and logged in.");
	}
	if (Array.isArray(secrets) && secrets.some((secret) => secret?.name === LOCAL_ADMIN_FLAG)) {
		problems.push(`${LOCAL_ADMIN_FLAG} is a deployed secret. Remove it with \`npx wrangler secret delete ${LOCAL_ADMIN_FLAG}\`.`);
	}
}

if (problems.length) {
	console.error("\n✋ check-env refused to continue:\n");
	for (const problem of problems) console.error(`  • ${problem}`);
	console.error("\nSecrets go in .dev.vars (local) or `npx wrangler secret put NAME` (production).\n");
	process.exit(1);
}

console.log("✓ check-env: no secrets in .env files, NEXT_PUBLIC_ variables or committed config.");
