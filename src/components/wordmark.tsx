import { site } from "@/lib/site";

/**
 * The text-only wordmark: "Bobby" in ink and "Builds" in the accent blue (the admin's blue in the
 * admin, the public page's blue on public pages). Semibold, or `bold` on public pages to match the
 * big "BobbyBuilds" heading. An optional suffix ("HQ" in the admin top bar) follows in muted grey,
 * after a real space so screen readers say "BobbyBuilds HQ".
 */
export function Wordmark({ suffix, bold = false }: { suffix?: string; bold?: boolean }) {
	const [first, second] = site.wordmark;
	const weight = bold ? "font-bold" : "font-semibold";
	return (
		<span className="text-lg tracking-tight">
			<span className={`${weight} text-ink`}>{first}</span>
			<span className={`${weight} text-accent`}>{second}</span>
			{suffix && (
				<>
					{" "}
					<span className="font-normal text-muted">{suffix}</span>
				</>
			)}
		</span>
	);
}
