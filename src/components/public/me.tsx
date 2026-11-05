import { PROFILE_PHOTO } from "@/lib/logos.generated";
import { owner, site } from "@/lib/site";
import { GitHubIcon, LinkedInIcon, MailIcon } from "./icons";

/** Each link's icon in its brand colour (LinkedIn's blue, GitHub's black or white mark); Email stays ink. */
const ICONS: Record<string, { Icon: typeof LinkedInIcon; colour: string }> = {
	LinkedIn: { Icon: LinkedInIcon, colour: "text-[var(--brand-linkedin)]" },
	GitHub: { Icon: GitHubIcon, colour: "text-[var(--brand-github)]" },
	Email: { Icon: MailIcon, colour: "text-ink" },
};

/** The profile photo (public/profile.*), or the initial until there is one. 64px on phones, 96px from sm up. */
export function Photo({ className = "h-16 w-16 sm:h-24 sm:w-24" }: { className?: string }) {
	if (PROFILE_PHOTO) {
		// eslint-disable-next-line @next/next/no-img-element -- one small local photo
		return <img src={PROFILE_PHOTO} alt={`Photo of ${owner.firstName}`} width={192} height={192} className={`${className} shrink-0 rounded-full border border-line object-cover`} />;
	}
	return (
		<span role="img" aria-label={`${owner.firstName}'s initial`} className={`${className} inline-flex shrink-0 items-center justify-center rounded-full bg-ink text-2xl font-semibold text-page sm:text-3xl`}>
			{owner.firstName.slice(0, 1)}
		</span>
	);
}

/**
 * The intro, kept short so the projects come sooner. The photo on the left; to its right one line
 * with "BobbyBuilds" (large) and "Wahab (Bobby) Khan, Leeds" in small grey text (wrapping under the
 * heading when there's no room), the bio about 8px underneath, then the link icons under the bio.
 * On phones: the photo and heading on the first line, then the bio and icons full width.
 */
export function Me() {
	return (
		<section aria-labelledby="me-name" className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 sm:items-start sm:gap-x-6">
			{/* Spans all three rows from sm up, so the bio and icons sit right under the heading, not under the photo. */}
			<div className="sm:row-span-3">
				<Photo />
			</div>
			<div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 sm:pt-2">
				<h1 id="me-name" className="text-[min(44px,11vw)] font-bold leading-none tracking-tight sm:text-[64px]">
					{site.name}
				</h1>
				<p className="text-sm text-muted">
					{owner.name}, {owner.location}
				</p>
			</div>
			<p className="col-span-2 mt-2 max-w-[60ch] text-base leading-relaxed text-ink-2 sm:col-span-1 sm:col-start-2 sm:text-lg">{owner.bio}</p>
			<ul className="col-span-2 -ml-1.5 mt-2 flex items-center gap-1 sm:col-span-1 sm:col-start-2" aria-label="Find me on">
				{owner.links.map((link) => {
					const icon = ICONS[link.label];
					const external = link.url.startsWith("https://");
					const name = link.label === "Email" ? `Email ${link.url.replace("mailto:", "")}` : link.label;
					return (
						<li key={link.url}>
							<a
								href={link.url}
								{...(external ? { target: "_blank", rel: "noopener noreferrer me" } : {})}
								title={link.label}
								className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-pill"
							>
								{icon ? <icon.Icon className={`h-5 w-5 ${icon.colour}`} /> : <span className="text-sm">{link.label}</span>}
								<span className="sr-only">
									{name}
									{external ? " (opens in a new tab)" : ""}
								</span>
							</a>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
