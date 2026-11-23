import { site } from "@/lib/site";

/** The favicon's own artwork (public/icon.svg, from brand/icon.svg), with the same version as the icon links. */
const ICON = "/icon.svg?v=2";

/**
 * The text-only wordmark, bold and all in ink, the same on the public pages and in the admin. An
 * optional suffix ("HQ" in the admin top bar) follows in muted grey, after a real space so screen
 * readers say "BobbyBuilds HQ". With `icon`, the lockup: the B icon (22px, decorative) 8px before the
 * name, vertically centred; below 360px wide only the icon shows, and the name stays for screen readers.
 * With `large` (the public header), the icon is 32px and the name 20px.
 */
export function Wordmark({ suffix, icon = false, large = false }: { suffix?: string; icon?: boolean; large?: boolean }) {
	const name = (
		<>
			<span className="font-bold text-ink">{site.name}</span>
			{suffix && (
				<>
					{" "}
					<span className="font-normal text-muted">{suffix}</span>
				</>
			)}
		</>
	);
	if (!icon) return <span className="text-lg tracking-tight">{name}</span>;
	// `large`: the public pages' header (Phase 12), a 32px icon and 20px name, 12px apart.
	const size = large ? 32 : 22;
	return (
		<span className={`inline-flex items-center tracking-tight ${large ? "gap-3 text-xl" : "gap-2 text-lg"}`}>
			{/* eslint-disable-next-line @next/next/no-img-element -- one tiny local SVG */}
			<img src={ICON} alt="" width={size} height={size} className="block shrink-0" style={{ width: size, height: size }} />
			<span className="max-[359px]:sr-only">{name}</span>
		</span>
	);
}
