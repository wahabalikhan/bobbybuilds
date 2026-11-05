import { site } from "@/lib/site";

/**
 * The text-only wordmark, both halves in semibold: "Bobby" in ink, "Builds" in the accent blue
 * (--accent: 6.7:1 on white, and the admin's dark-theme blue is 6.3:1 on its dark page). An
 * optional suffix ("HQ" in the admin top bar) follows in muted grey, after a real space so screen
 * readers say "BobbyBuilds HQ". Used in the admin top bar. The public pages use `mono`: "Builds" in
 * grey instead of blue, because the public page has no blue.
 */
export function Wordmark({ suffix, mono = false }: { suffix?: string; mono?: boolean }) {
	const [first, second] = site.wordmark;
	return (
		<span className="text-lg tracking-tight">
			<span className="font-semibold text-ink">{first}</span>
			<span className={`font-semibold ${mono ? "text-muted" : "text-accent"}`}>{second}</span>
			{suffix && (
				<>
					{" "}
					<span className="font-normal text-muted">{suffix}</span>
				</>
			)}
		</span>
	);
}
