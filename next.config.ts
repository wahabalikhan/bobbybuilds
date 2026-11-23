import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Don't advertise the framework. Security headers are set in src/middleware.ts.
	poweredByHeader: false,
	// Project pages were removed: project cards open the project itself. Old links land on the home
	// page. (Journey entries have their own pages again, /journey/<slug>, since Phase 12.)
	async redirects() {
		return [{ source: "/p/:path*", destination: "/", permanent: true }];
	},
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
