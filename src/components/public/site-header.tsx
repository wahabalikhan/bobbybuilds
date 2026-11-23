import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { owner, site } from "@/lib/site";
import { PUBLIC_PAGE } from "@/lib/layout";
import { pillButton } from "./bits";

const EMAIL = owner.links.find((l) => l.label === "Email")!.url;

/** The top navigation: the home page's sections, the journey, and "Say hello" (an email). */
const NAV = [
	{ label: "Projects", href: "/#projects" },
	{ label: "Numbers", href: "/#numbers" },
	{ label: "Journey", href: "/journey" },
] as const;

/**
 * The header on every public page: the B icon and "BobbyBuilds" (home), then on the right Projects,
 * Numbers, Journey and a dark "Say hello" (on phones they wrap under the wordmark). `current` marks
 * the page you're on (a white pill, aria-current): Journey on /journey and on every journey post.
 */
export function SiteHeader({ current }: { current?: "journey" } = {}) {
	return (
		<header className={`${PUBLIC_PAGE} flex flex-wrap items-center justify-between gap-x-6 gap-y-4 pb-6 pt-8 sm:pt-10`}>
			<Link href="/" aria-label={site.name} className="inline-flex min-h-11 items-center rounded-lg">
				<Wordmark icon large />
			</Link>
			<nav aria-label="Main" className="w-full sm:w-auto">
				<ul className="flex flex-wrap items-center gap-1 sm:gap-2">
					{NAV.map((item) => {
						const isCurrent = current === "journey" && item.href === "/journey";
						return (
							<li key={item.href}>
								<Link
									href={item.href}
									aria-current={isCurrent ? "page" : undefined}
									className={`inline-flex h-11 items-center rounded-full px-4 text-[15px] font-medium text-ink transition-colors hover:bg-card ${isCurrent ? "border border-line bg-card" : ""}`}
								>
									{item.label}
								</Link>
							</li>
						);
					})}
					<li className="basis-full sm:basis-auto">
						<a href={EMAIL} className={`${pillButton("dark")} font-semibold`}>
							Say hello
						</a>
					</li>
				</ul>
			</nav>
		</header>
	);
}

export function SkipLink() {
	return (
		<a href="#content" className="sr-only rounded-full bg-ink px-4 py-2 text-sm text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50">
			Skip to content
		</a>
	);
}
