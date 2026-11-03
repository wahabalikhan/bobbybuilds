import Link from "next/link";
import { owner, site } from "@/lib/site";
import { AdminKeyboardShortcut } from "./admin-shortcut";
import { Avatar } from "./profile";
import { PAGE } from "@/lib/layout";

/** A slim header for the journey and 404 pages. */
export function SiteHeader() {
	return (
		<header className="border-b border-line">
			<AdminKeyboardShortcut />
			<div className={`${PAGE} flex items-center justify-between gap-4 py-4`}>
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
