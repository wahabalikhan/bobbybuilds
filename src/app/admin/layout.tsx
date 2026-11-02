import type { Metadata } from "next";
import { headers } from "next/headers";
import { LOCAL_ADMIN_HEADER } from "@/lib/security/local-admin";

export const metadata: Metadata = {
	title: "Admin",
	robots: { index: false, follow: false },
};

// Admin pages render per request (reading headers() makes them dynamic) so Next.js can
// apply the CSP nonce from middleware.ts.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	const localAdmin = (await headers()).get(LOCAL_ADMIN_HEADER) === "1";
	return (
		<div className="mx-auto max-w-5xl p-8">
			{localAdmin && (
				<p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
					Local preview: Cloudflare Access is skipped on this machine only.
				</p>
			)}
			{children}
		</div>
	);
}
