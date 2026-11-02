import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { LiveDataBanner } from "@/components/admin/live-banner";
import { isLiveData } from "@/lib/admin/access";
import { listProjects } from "@/lib/db/projects";
import { LOCAL_ADMIN_HEADER } from "@/lib/security/local-admin";
import { adminHref, site } from "@/lib/site";

export const metadata: Metadata = {
	title: "Admin",
	robots: { index: false, follow: false },
};

// Admin pages render per request (reading headers() makes them dynamic) so Next.js can
// apply the CSP nonce from middleware.ts.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	const localAdmin = (await headers()).get(LOCAL_ADMIN_HEADER) === "1";
	const { env } = await getCloudflareContext({ async: true });
	// Whenever the live database is connected, the banner shows. No other condition.
	const live = isLiveData(env as unknown as Record<string, unknown>);
	const projects = await listProjects(env.DB);

	return (
		<div className="min-h-screen bg-page">
			{live ? (
				<LiveDataBanner />
			) : (
				localAdmin && (
					<p className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
						Local preview: Cloudflare Access is skipped on this machine only. This is your local database.
					</p>
				)
			)}
			<header className="border-b border-line">
				<div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
					<Link href={adminHref()} className="font-semibold tracking-tight">
						{site.name} <span className="font-normal text-muted">HQ</span>
					</Link>
					<nav aria-label="Projects" className="flex flex-1 flex-wrap gap-1 text-sm text-ink-2">
						<Link href={adminHref()} className="rounded-full px-3 py-1.5 hover:bg-pill hover:text-ink">
							Overview
						</Link>
						{projects.map((p) => (
							<Link key={p.id} href={adminHref(`/projects/${p.slug}`)} className="rounded-full px-3 py-1.5 hover:bg-pill hover:text-ink">
								{p.name}
							</Link>
						))}
					</nav>
					<Link href={adminHref("/settings")} className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-page hover:opacity-85">
						Settings
					</Link>
				</div>
			</header>
			<main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
		</div>
	);
}
