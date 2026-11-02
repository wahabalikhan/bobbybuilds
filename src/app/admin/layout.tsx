import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
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
	const live = localAdmin && isLiveData();
	const { env } = await getCloudflareContext({ async: true });
	const projects = await listProjects(env.DB);

	return (
		<div className="min-h-screen bg-page">
			{live ? (
				<p role="alert" className="bg-critical px-4 py-2 text-center text-sm font-semibold text-white">
					LIVE DATA: you&rsquo;re looking at, and can change, the live database from your own machine.
				</p>
			) : (
				localAdmin && (
					<p className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
						Local preview: Cloudflare Access is skipped on this machine only. This is your local database.
					</p>
				)
			)}
			<header className="border-b border-line bg-card">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
					<Link href={adminHref()} className="font-semibold tracking-tight">
						{site.name} <span className="font-normal text-muted">HQ</span>
					</Link>
					<nav aria-label="Projects" className="flex flex-wrap gap-4 text-sm text-ink-2">
						<Link href={adminHref()} className="hover:text-ink">Overview</Link>
						{projects.map((p) => (
							<Link key={p.id} href={adminHref(`/projects/${p.slug}`)} className="hover:text-ink">
								{p.name}
							</Link>
						))}
					</nav>
				</div>
			</header>
			<main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
		</div>
	);
}
