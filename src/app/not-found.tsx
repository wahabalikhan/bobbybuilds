import type { Metadata } from "next";
import Link from "next/link";
import { pillButton } from "@/components/public/bits";
import { SiteFooter } from "@/components/public/footer";
import { SiteHeader } from "@/components/public/site-header";
import { PublicTracker } from "@/components/public/tracker";
import { CARD, PUBLIC_PAGE } from "@/lib/layout";

// "Page not found · BobbyBuilds" (the layout adds the brand).
export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
	return (
		<div className="public-theme min-h-screen bg-page font-sans text-ink">
			<PublicTracker />
			<SiteHeader />
			<main id="content" data-bobby-not-found className={PUBLIC_PAGE}>
				<div className={`${CARD} p-7 sm:p-12`}>
					<h1 className="text-[clamp(2.375rem,10vw,3.5rem)] font-extrabold leading-[1.02] tracking-[-0.035em]">Page not found</h1>
					<p className="mt-4 max-w-[560px] text-[17px] leading-relaxed text-ink-2 sm:text-lg">There&rsquo;s nothing at this address. It may have moved, or the project may have a new name.</p>
					<div className="mt-8 flex flex-wrap gap-2">
						<Link href="/" className={`${pillButton("dark")} font-semibold`}>
							Back to the projects
						</Link>
						<Link href="/journey" className={pillButton("quiet")}>
							Read the journey
						</Link>
					</div>
				</div>
			</main>
			<SiteFooter year={new Date().getUTCFullYear()} />
		</div>
	);
}
