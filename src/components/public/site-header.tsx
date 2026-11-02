import Link from "next/link";
import { owner, site } from "@/lib/site";
import { Avatar } from "./profile";

/** A slim header for the journey and 404 pages. */
export function SiteHeader() {
	return (
		<header className="border-b border-line">
			<div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
				<Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
					<Avatar size={28} />
					{owner.name}
				</Link>
				<nav aria-label="Site" className="flex gap-1 text-sm text-ink-2">
					<Link href="/" className="rounded-full px-3 py-1.5 hover:bg-pill hover:text-ink">
						Projects
					</Link>
					{site.showJourney && (
						<Link href="/journey" className="rounded-full px-3 py-1.5 hover:bg-pill hover:text-ink">
							Journey
						</Link>
					)}
				</nav>
			</div>
		</header>
	);
}

export function SkipLink() {
	return (
		<a href="#content" className="sr-only rounded-full bg-ink px-4 py-2 text-sm text-page focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50">
			Skip to content
		</a>
	);
}
