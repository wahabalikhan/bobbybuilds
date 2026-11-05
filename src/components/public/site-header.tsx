import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { site } from "@/lib/site";
import { PAGE } from "@/lib/layout";
import { FadingHeader } from "./fading-header";

/**
 * The small wordmark at the top of every public page (bold and all in ink, like the big heading), linking home. No navigation bar.
 * On the home page (`showAfter` = the Projects section) it's a fixed bar that only slides in once
 * the top of Projects has scrolled up to the top of the screen (FadingHeader); elsewhere it's always shown.
 */
export function SiteHeader({ showAfter }: { showAfter?: string } = {}) {
	if (showAfter) return <FadingHeader showAfter={showAfter} label={`${site.name} home`} />;
	return (
		<header className={`${PAGE} pt-6 sm:pt-8`}>
			<Link href="/" className="inline-block rounded-sm" aria-label={`${site.name} home`}>
				<Wordmark />
			</Link>
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
