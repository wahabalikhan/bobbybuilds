"use client";

import { useSyncExternalStore } from "react";
import { COUNT_HASH, IGNORE_HASH, IGNORE_KEY } from "@/tracker/ignore";
import { ArrowIcon } from "@/components/public/icons";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
	listeners.add(listener);
	window.addEventListener("storage", listener);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", listener);
	};
}

/** null until it's known (server render, or storage blocked). */
function read(): boolean | null {
	try {
		return window.localStorage.getItem(IGNORE_KEY) === "1";
	} catch {
		return null;
	}
}

function write(ignore: boolean) {
	try {
		if (ignore) window.localStorage.setItem(IGNORE_KEY, "1");
		else window.localStorage.removeItem(IGNORE_KEY);
	} catch {
		// Storage is blocked: the switch stays as it was.
	}
	for (const listener of listeners) listener();
}

/**
 * "Don't count my visits": a switch for this site (the admin shares bobbybuilds.app with the
 * public pages, so it covers BobbyBuilds), and a link to open once on each other site. t.js reads
 * the same flag (src/tracker/ignore.ts) and sends nothing from this browser while it's set.
 */
export function CountMyVisits({ sites }: { sites: { name: string; origin: string }[] }) {
	const ignored = useSyncExternalStore(subscribe, read, () => null);
	const host = useSyncExternalStore(subscribe, () => window.location.host, () => "");
	return (
		<section aria-labelledby="count-heading" className="space-y-4">
			<h2 id="count-heading" className="text-[15px] font-medium tracking-tight">
				This browser
			</h2>
			<div className="divide-y divide-line rounded-2xl border border-line bg-card">
				<div className="flex items-start justify-between gap-4 px-4 py-4">
					<span className="text-sm" id="count-label">
						<span className="font-medium">Don&rsquo;t count my visits on {host || "this site"}</span>
						<span className="block text-muted">
							{ignored === null
								? "This browser won't let us remember this setting."
								: ignored
									? "On: your visits to BobbyBuilds from this browser aren't counted."
									: "Off: your visits to BobbyBuilds from this browser are counted."}
						</span>
					</span>
					<button
						type="button"
						role="switch"
						aria-checked={ignored === true}
						aria-labelledby="count-label"
						disabled={ignored === null}
						onClick={() => write(!ignored)}
						className="group relative mt-0.5 inline-flex shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50"
					>
						<span aria-hidden className={`h-6 w-10 rounded-full transition-colors ${ignored ? "bg-ink" : "bg-[var(--axis)]"}`} />
						<span aria-hidden className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${ignored ? "translate-x-4" : ""}`} />
					</button>
				</div>
				{sites.length > 0 && (
					<div className="space-y-2 px-4 py-4 text-sm">
						<p className="text-ink-2">On your other sites, open each link once, in every browser you use (on each device). The site shows a message to say it&rsquo;s done.</p>
						<ul className="space-y-1">
							{sites.map((s) => (
								<li key={s.origin} className="flex flex-wrap items-baseline gap-x-2">
									<span className="font-medium">{s.name}</span>
									<a href={`${s.origin}/${IGNORE_HASH}`} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 break-all">
										{s.origin.replace(/^https:\/\//, "")}/{IGNORE_HASH} <ArrowIcon />
										<span className="sr-only">(opens in a new tab)</span>
									</a>
								</li>
							))}
						</ul>
						<p className="text-muted">
							To be counted again, open the same address ending in <code>{COUNT_HASH}</code> instead.
						</p>
					</div>
				)}
			</div>
		</section>
	);
}
