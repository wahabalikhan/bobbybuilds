#!/usr/bin/env node
/** Bundles src/tracker/t.ts (with web-vitals) into public/t.js. Runs before dev and build. */
import { build } from "esbuild";
import { statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";

const outfile = "public/t.js";

await build({
	entryPoints: ["src/tracker/t.ts"],
	outfile,
	bundle: true,
	minify: true,
	format: "iife",
	target: "es2019",
	legalComments: "none",
	banner: { js: "/* Bobby Builds t.js: no cookies, no personal data. Respects GPC and Do Not Track. */" },
});

const bytes = statSync(outfile).size;
const gzipped = gzipSync(readFileSync(outfile)).length;
console.log(`✓ build-tracker: ${outfile} ${(bytes / 1024).toFixed(1)} KB (${(gzipped / 1024).toFixed(1)} KB gzipped)`);
