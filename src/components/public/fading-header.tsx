"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/wordmark";
import { PAGE } from "@/lib/layout";

/** The bar's height in px (h-14). */
const BAR = 56;

/**
 * The home page's header: a fixed bar that's hidden at the top of the page and fades in once the
 * top of the section `showAfter` (Projects) has scrolled up to the top of the screen, and fades out
 * the same way when you scroll back up. No fade with reduced motion. While hidden it can't be clicked, but its
 * link stays in the page for keyboard and screen reader users, and the bar shows while it's focused.
 */
export function FadingHeader({ showAfter, label }: { showAfter: string; label: string }) {
	const [shown, setShown] = useState(false);

	useEffect(() => {
		const section = document.getElementById(showAfter);
		if (!section) return;
		let frame = 0;
		const update = () => {
			frame = 0;
			setShown(section.getBoundingClientRect().top <= BAR);
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(update);
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll, { passive: true });
		onScroll();
		return () => {
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
			if (frame) cancelAnimationFrame(frame);
		};
	}, [showAfter]);

	return (
		<header
			data-shown={shown}
			className={`fixed inset-x-0 top-0 z-30 border-b border-line bg-page transition-opacity duration-300 motion-reduce:transition-none ${
				shown ? "opacity-100" : "pointer-events-none opacity-0 has-[a:focus-visible]:pointer-events-auto has-[a:focus-visible]:opacity-100"
			}`}
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
					className="inline-block rounded-sm"
				>
					<Wordmark />
				</Link>
			</div>
		</header>
	);
}
