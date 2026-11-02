import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Don't advertise the framework. Security headers are set in src/middleware.ts.
	poweredByHeader: false,
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
