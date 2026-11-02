import { PROFILE_PHOTO } from "@/lib/logos.generated";
import { owner } from "@/lib/site";
import { GitHubIcon, LinkedInIcon } from "./icons";

const ICONS: Record<string, typeof LinkedInIcon> = { LinkedIn: LinkedInIcon, GitHub: GitHubIcon };

export function Avatar({ size = 72 }: { size?: number }) {
	if (PROFILE_PHOTO) {
		// eslint-disable-next-line @next/next/no-img-element -- one small local photo
		return <img src={PROFILE_PHOTO} alt={`Photo of ${owner.firstName}`} width={size} height={size} className="rounded-full border border-line object-cover" style={{ width: size, height: size }} />;
	}
	return (
		<span role="img" aria-label={`${owner.firstName}'s initial`} className="inline-flex items-center justify-center rounded-full bg-ink font-semibold text-page" style={{ width: size, height: size, fontSize: size * 0.42 }}>
			{owner.firstName.slice(0, 1)}
		</span>
	);
}

/** The profile panel: photo, name, bio and social links. */
export function ProfileCard() {
	return (
		<section aria-labelledby="profile-name" className="rounded-2xl border border-line bg-card p-6">
			<Avatar />
			<h1 id="profile-name" className="mt-4 text-2xl font-bold tracking-tight">
				{owner.name}
			</h1>
			<p className="mt-4 text-sm leading-relaxed text-ink-2">{owner.bio}</p>
			<ul className="mt-5 flex flex-wrap gap-2" aria-label="Find me on">
				{owner.links.map((link) => {
					const Icon = ICONS[link.label];
					return (
						<li key={link.url}>
							<a
								href={link.url}
								rel="noopener noreferrer me"
								className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-ink hover:bg-pill"
							>
								{Icon && <Icon />}
								{link.label}
							</a>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
