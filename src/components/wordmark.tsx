import { site } from "@/lib/site";

/**
 * The text-only wordmark. In the admin: semibold, "Bobby" in ink and "Builds" in the admin's accent
 * blue. On public pages (`bold`): bold and all in ink, matching the big "BobbyBuilds" heading. An optional suffix ("HQ" in the admin top bar) follows in muted grey,
 * after a real space so screen readers say "BobbyBuilds HQ".
 */
export function Wordmark({ suffix, bold = false }: { suffix?: string; bold?: boolean }) {
	const [first, second] = site.wordmark;
	const weight = bold ? "font-bold" : "font-semibold";
	return (
		<span className="text-lg tracking-tight">
			<span className={`${weight} text-ink`}>{first}</span>
			<span className={`${weight} ${bold ? "text-ink" : "text-accent"}`}>{second}</span>
			{suffix && (
				<>
					{" "}
					<span className="font-normal text-muted">{suffix}</span>
				</>
			)}
		</span>
	);
}
