import { COUNT_HASH, IGNORE_HASH } from "@/tracker/ignore";
import { ArrowIcon } from "@/components/public/icons";

/**
 * The Settings card's "Advanced": turning off counting on your other sites, once per browser.
 * BobbyBuilds itself needs nothing: signed into the admin, your visits there are never counted
 * (OwnVisitsNotCounted). Each button opens the site with #bobby-ignore, which t.js keeps in that
 * browser ("Turn off on my portfolio" for Portfolio, the project's name for the rest).
 */
export function OtherSites({ sites }: { sites: { name: string; origin: string }[] }) {
	return (
		<details className="group pt-2">
			<summary className="flex list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
				Advanced
				<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180">
					<path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			</summary>
			<div className="mt-3 space-y-3 text-sm">
				<p className="text-ink-2">Your visits to BobbyBuilds aren&rsquo;t counted while you&rsquo;re signed in here. To stop counting your visits to your other sites too, press each button once in every browser you use.</p>
				<ul className="flex flex-wrap gap-2">
					{sites.map((s) => (
						<li key={s.origin}>
							<a href={`${s.origin}/${IGNORE_HASH}`} target="_blank" rel="noopener noreferrer" className="btn-secondary control inline-flex items-center gap-1.5 px-3.5 text-sm">
								Turn off on {s.name === "Portfolio" ? "my portfolio" : s.name} <ArrowIcon />
								<span className="sr-only">(opens in a new tab)</span>
							</a>
						</li>
					))}
				</ul>
				<p className="text-muted">
					To be counted again, open the site with <code>{COUNT_HASH}</code> at the end of its address.
				</p>
			</div>
		</details>
	);
}
