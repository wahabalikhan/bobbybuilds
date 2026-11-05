import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { site } from "@/lib/site";
import { PAGE } from "@/lib/layout";
import { FadingHeader } from "./fading-header";

/**
 * The small monochrome wordmark at the top of every public page, linking home. No navigation bar.
 * On the home page (`hideWhileVisible` = the big heading's id) it's a sticky bar whose wordmark only
 * fades in once that heading has scrolled away (FadingHeader); elsewhere it's always shown.
 */
export function SiteHeader({ hideWhileVisible }: { hideWhileVisible?: string } = {}) {
	if (hideWhileVisible) return <FadingHeader targetId={hideWhileVisible} label={`${site.name} home`} />;
	return (
		<header className={`${PAGE} pt-6 sm:pt-8`}>
			<Link href="/" className="inline-block rounded-sm" aria-label={`${site.name} home`}>
				<Wordmark mono />
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
