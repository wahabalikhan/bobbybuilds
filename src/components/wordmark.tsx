import { site } from "@/lib/site";

/** The favicon's own artwork (public/icon.svg, from brand/icon.svg), with the same version as the icon links. */
const ICON = "/icon.svg?v=2";

/**
 * The text-only wordmark, bold and all in ink, the same on the public pages and in the admin. An
 * optional suffix ("HQ" in the admin top bar) follows in muted grey, after a real space so screen
 * readers say "BobbyBuilds HQ". With `icon`, the lockup: the B icon (22px, decorative) 8px before the
 * name, vertically centred; below 360px wide only the icon shows, and the name stays for screen readers.
 */
export function Wordmark({ suffix, icon = false }: { suffix?: string; icon?: boolean }) {
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
	return (
		<span className="inline-flex items-center gap-2 text-lg tracking-tight">
			{/* eslint-disable-next-line @next/next/no-img-element -- one tiny local SVG */}
			<img src={ICON} alt="" width={22} height={22} className="block h-[22px] w-[22px] shrink-0" />
			<span className="max-[359px]:sr-only">{name}</span>
		</span>
	);
}
