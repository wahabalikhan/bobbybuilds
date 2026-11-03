#!/usr/bin/env node
/**
 * Bundles the tracker into public/:
 *   t.js         the tracker (src/tracker/t.ts)
 *   t-vitals.js  Core Web Vitals via web-vitals (src/tracker/vitals.ts), loaded by t.js after page load
 * Runs before dev and build.
 */
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const outputs = [
	{ entry: "src/tracker/t.ts", outfile: "public/t.js", banner: "/* BobbyBuilds t.js: no cookies, no personal data. Respects GPC and Do Not Track. */" },
	{ entry: "src/tracker/vitals.ts", outfile: "public/t-vitals.js", banner: "/* BobbyBuilds t-vitals.js: Core Web Vitals for t.js (web-vitals, Apache-2.0). */" },
];

for (const { entry, outfile, banner } of outputs) {
	await build({
		entryPoints: [entry],
		outfile,
		bundle: true,
		minify: true,
		format: "iife",
		target: "es2019",
		legalComments: "none",
		banner: { js: banner },
	});
	const file = readFileSync(outfile);
	console.log(`✓ build-tracker: ${outfile} ${(file.length / 1024).toFixed(1)} KB (${(gzipSync(file).length / 1024).toFixed(1)} KB gzipped)`);
}
