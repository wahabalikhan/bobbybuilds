"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/wordmark";
import { PAGE } from "@/lib/layout";

/** The bar's height in px (h-14). The heading counts as out of view once it's gone under the bar. */
const BAR = 56;

/**
 * The home page's header: a sticky bar whose wordmark is hidden while the big "BobbyBuilds" heading
 * (`targetId`) is on screen, so it isn't said twice, and fades in (with the bar's background and
 * hairline) once the heading has scrolled away. Watched with an IntersectionObserver; no fade with
 * reduced motion. While hidden it can't be clicked, but it stays in the page for keyboard and
 * screen reader users, and shows when it's focused.
 */
export function FadingHeader({ targetId, label }: { targetId: string; label: string }) {
	const [shown, setShown] = useState(false);

	useEffect(() => {
		// The home page always has the heading; without it there's nothing to watch.
		const heading = document.getElementById(targetId);
		if (!heading) return;
		const observer = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting), { rootMargin: `-${BAR}px 0px 0px 0px` });
		observer.observe(heading);
		return () => observer.disconnect();
	}, [targetId]);

	return (
		<header
			data-shown={shown}
			className="sticky top-0 z-30 border-b border-transparent transition-colors duration-300 motion-reduce:transition-none data-[shown=true]:border-line data-[shown=true]:bg-page"
		>
			<div className={`${PAGE} flex h-14 items-center`}>
				<Link
					href="/"
					aria-label={label}
					// Already on the home page: go back to the top (Next.js does nothing for a link to the current page).
					onClick={(event) => {
						if (window.location.pathname !== "/") return;
						event.preventDefault();
						const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
						window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
						if (window.location.hash) history.replaceState(null, "", "/");
					}}
					className={`inline-block rounded-sm transition-opacity duration-300 motion-reduce:transition-none ${shown ? "opacity-100" : "pointer-events-none opacity-0 focus-visible:opacity-100"}`}
				>
					<Wordmark mono />
				</Link>
			</div>
		</header>
	);
}
