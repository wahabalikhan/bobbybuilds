import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/admin/ui";
import { SiteHeader } from "@/components/public/site-header";
import { PublicTracker } from "@/components/public/tracker";
import { PAGE } from "@/lib/layout";

// "Page not found · BobbyBuilds" (the layout adds the brand).
export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
	return (
		<>
			<PublicTracker />
			<SiteHeader />
			<main id="content" data-bobby-not-found className={`${PAGE} py-16`}>
				<h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
				<p className="mt-2 text-ink-2">There&rsquo;s nothing at this address. It may have moved, or the project may have a new name.</p>
				<Link href="/" className={`${buttonClass} mt-6`}>
					Back to the projects
				</Link>
			</main>
		</>
	);
}
