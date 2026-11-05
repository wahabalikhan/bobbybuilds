import { site } from "@/lib/site";

/**
 * The text-only wordmark, bold and all in ink, the same on the public pages and in the admin. An
 * optional suffix ("HQ" in the admin top bar) follows in muted grey, after a real space so screen
 * readers say "BobbyBuilds HQ".
 */
export function Wordmark({ suffix }: { suffix?: string }) {
	return (
		<span className="text-lg tracking-tight">
			<span className="font-bold text-ink">{site.name}</span>
			{suffix && (
				<>
					{" "}
					<span className="font-normal text-muted">{suffix}</span>
				</>
			)}
		</span>
	);
}
