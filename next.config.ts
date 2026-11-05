import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Don't advertise the framework. Security headers are set in src/middleware.ts.
	poweredByHeader: false,
	// Project pages and journey entry pages were removed: project cards open the project itself, and
	// the journey is a section of the home page. Old links land there.
	async redirects() {
		return [
			{ source: "/p/:path*", destination: "/", permanent: true },
			{ source: "/journey/:path*", destination: "/#journey", permanent: true },
		];
	},
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
