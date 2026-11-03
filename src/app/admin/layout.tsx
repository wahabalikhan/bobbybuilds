import type { Metadata } from "next";
import Link from "next/link";
import { AdminKeyboardShortcut } from "@/components/public/admin-shortcut";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { LiveDataBanner } from "@/components/admin/live-banner";
import { StatusMenu } from "@/components/admin/status-menu";
import { requestTime } from "@/lib/admin/clock";
import { attentionItems } from "@/lib/db/dashboard";
import { isLiveData } from "@/lib/admin/access";
import { LOCAL_ADMIN_HEADER } from "@/lib/security/local-admin";
import { adminHref, adminName, site } from "@/lib/site";
import { PAGE } from "@/lib/layout";

export const metadata: Metadata = {
	// "BobbyBuilds HQ" on Home; other admin pages set only their own name ("Tech Jobs · BobbyBuilds HQ").
	// absolute: the public layout's " · BobbyBuilds" template isn't added to the admin's own name.
	title: { absolute: adminName, template: `%s · ${adminName}` },
	robots: { index: false, follow: false },
};

// Admin pages render per request (reading headers() makes them dynamic) so Next.js can
// apply the CSP nonce from middleware.ts.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	const localAdmin = (await headers()).get(LOCAL_ADMIN_HEADER) === "1";
	const { env } = await getCloudflareContext({ async: true });
	// Whenever the live database is connected, the banner shows. No other condition.
	const live = isLiveData(env as unknown as Record<string, unknown>);
	// "Is everything OK?" for every admin page: the pill next to the name.
	const attention = await attentionItems(env.DB, requestTime());

	return (
		<div className="admin-theme min-h-screen bg-page text-ink">
			{live ? (
				<LiveDataBanner />
			) : (
				localAdmin && (
					<p className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
						Local preview: Cloudflare Access is skipped on this machine only. This is your local database.
					</p>
				)
			)}
			{/* Option + A (Alt + A) back to the public site. No visible link. */}
			<AdminKeyboardShortcut to={site.url} />
			<header className="border-b border-line">
				<div className={`${PAGE} flex flex-wrap items-center gap-x-4 gap-y-2 py-4`}>
					<Link href={adminHref()} className="font-semibold tracking-tight">
						{site.name} <span className="font-normal text-muted">HQ</span>
					</Link>
					<StatusMenu items={attention} />
				</div>
			</header>
			<main className={`${PAGE} min-w-0 pb-12 pt-6`}>{children}</main>
		</div>
	);
}
