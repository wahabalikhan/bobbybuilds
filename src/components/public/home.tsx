import Link from "next/link";
import { now } from "@content/now";
import { formatDay, formatWhole } from "@/lib/format";
import { imageSet } from "@/lib/images";
import { journeyType } from "@/lib/journey-types";
import { CARD, EYEBROW } from "@/lib/layout";
import { PROFILE_PHOTO } from "@/lib/logos.generated";
import { RECENT_DAYS } from "@/lib/public/product-line";
import { postHref, type JourneyPost } from "@/lib/public/journey";
import type { PublicGithub, PublicProject } from "@/lib/public/snapshot";
import { addDays } from "@/lib/days";
import { owner } from "@/lib/site";
import { Arrow, CARD_FOCUS, NEW_TAB, pillButton, StatusPill, STRETCHED_LINK } from "./bits";
import { ContributionGrid } from "./mono-charts";

/** Big card headings: weight 800, tight letter spacing. */
const HEADING = "font-extrabold tracking-[-0.035em]";

/** "Project 01": the project's place in the public order. */
const projectNumber = (n: number) => `Project ${String(n).padStart(2, "0")}`;

/** The profile photo (public/profile.*), or the initial until there is one. */
function Photo() {
	if (PROFILE_PHOTO) {
		// eslint-disable-next-line @next/next/no-img-element -- one small local photo
		return <img src={PROFILE_PHOTO} alt={`Photo of ${owner.firstName}`} width={168} height={168} className="h-[72px] w-[72px] shrink-0 rounded-full object-cover sm:h-[84px] sm:w-[84px]" />;
	}
	return (
		<span role="img" aria-label={`${owner.firstName}'s initial`} className="inline-flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-ink text-3xl font-bold text-white sm:h-[84px] sm:w-[84px]">
			{owner.firstName.slice(0, 1)}
		</span>
	);
}

/**
 * The intro: photo, name and what I'm building now (a green pill, from content/now.ts), the big
 * headline (the page's h1, scaled with clamp so it's about 4 lines on a 390px phone), the intro
 * line and the LinkedIn, X and GitHub links.
 */
export function IntroCard({ className }: { className: string }) {
	const links = owner.links.filter((l) => l.label !== "Email");
	return (
		<section aria-labelledby="intro-heading" className={`${CARD} flex flex-col p-7 sm:p-9 ${className}`}>
			<div className="flex items-center gap-4 sm:gap-6">
				<Photo />
				<div className="min-w-0">
					<p className="text-[15px] text-muted">{owner.name}</p>
					{now.status && (
						<p className="mt-2 inline-flex items-center gap-2 rounded-full bg-shipped-bg px-3 py-1.5 text-[15px] font-medium leading-tight text-shipped">
							<span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-shipped" />
							{now.status}
						</p>
					)}
				</div>
			</div>
			<h1 id="intro-heading" className={`mt-10 max-w-[760px] text-[clamp(2.375rem,10vw,3.5rem)] leading-[0.98] sm:mt-14 ${HEADING}`}>
				{owner.headline}
			</h1>
			<div className="mt-8 flex flex-col gap-6 sm:mt-auto sm:pt-12 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
				<p className="max-w-[480px] text-[17px] leading-[1.55] text-ink-2">{owner.bio}</p>
				<ul className="flex shrink-0 flex-wrap gap-2" aria-label="Find me on">
					{links.map((link) => (
						<li key={link.url}>
							<a href={link.url} target="_blank" rel="noopener noreferrer me" className={pillButton("quiet")}>
								{link.label}
								{NEW_TAB}
							</a>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}

/** A project's latest public product numbers (open jobs, companies), when they're under a week old. */
function liveNumbers(project: PublicProject, today: string) {
	const earliest = addDays(today, -RECENT_DAYS);
	return project.numbers.filter((n) => n.kind === "latest" && n.figure !== null && n.latestDay !== null && n.latestDay >= earliest).slice(0, 2);
}

/**
 * The featured project (the one with the "RealTechJobs blue" card style): a tall blue card with its
 * place, status, name, tagline (without numbers), its live numbers and its phone screenshot rising
 * from the bottom. The whole card opens the project's site.
 */
export function FeaturedProjectCard({ project, number, today, className }: { project: PublicProject; number: number; today: string; className: string }) {
	const shot = imageSet(project.screenshot?.src);
	const numbers = liveNumbers(project, today);
	return (
		<article id="projects" className={`lift relative ${CARD_FOCUS} flex scroll-mt-6 flex-col overflow-hidden rounded-[28px] bg-accent p-7 text-white sm:p-8 ${className}`}>
			<div className="flex items-center justify-between gap-3">
				<p className={`${EYEBROW} text-on-accent-2`}>{projectNumber(number)}</p>
				<StatusPill status={project.status} up={project.up} onBlue />
			</div>
			<h2 className={`mt-5 text-[clamp(2.25rem,9vw,2.75rem)] leading-none ${HEADING}`}>
				{project.siteUrl ? (
					<a href={project.siteUrl} target="_blank" rel="noopener noreferrer" data-card-link className={STRETCHED_LINK}>
						{project.name}
						{NEW_TAB}
					</a>
				) : (
					project.name
				)}
			</h2>
			{project.pitch && <p className="mt-4 text-[17px] leading-relaxed text-on-accent-2">{project.pitch}</p>}
			{numbers.length > 0 && (
				<dl className="mt-7 flex flex-wrap gap-x-8 gap-y-4">
					{numbers.map((n) => (
						<div key={n.key} className="flex flex-col-reverse">
							<dt className="mt-1 text-[15px] text-on-accent-2">{n.label.toLowerCase()}</dt>
							<dd className={`tabular text-[2.5rem] leading-none ${HEADING}`}>{formatWhole(n.figure!)}</dd>
						</div>
					))}
				</dl>
			)}
			{shot && project.screenshot && (
				// A phone in ink, cut off by the card's bottom edge.
				<div className="-mb-7 mt-auto flex justify-center pt-10 sm:-mb-8">
					<div className="h-[340px] w-[268px] max-w-[85%] overflow-hidden rounded-t-[40px] border-[10px] border-b-0 border-ink bg-ink shadow-[0_-20px_60px_-20px_rgb(10_20_80/0.45)]">
						{/* eslint-disable-next-line @next/next/no-img-element -- static WebP with srcset, from npm run build:images */}
						<img src={shot.src} srcSet={shot.srcSet} sizes="248px" width={shot.width} height={shot.height} alt={project.screenshot.alt} loading="lazy" className="h-full w-full rounded-t-[30px] object-cover object-top" />
					</div>
				</div>
			)}
		</article>
	);
}

/**
 * Another project: a white card with its place, status, name and tagline, and its Screenshot (from
 * Settings) full-bleed along the bottom: the whole image at its own shape, with no frame of its own
 * (use one that's already framed, like Portfolio's), only the card's bottom corners rounding it. The
 * card grows rather than cropping it. The whole card opens its site.
 */
export function ProjectCard({ project, number, anchor = false, className }: { project: PublicProject; number: number; anchor?: boolean; className: string }) {
	const shot = imageSet(project.screenshot?.src);
	return (
		<article id={anchor ? "projects" : undefined} className={`${CARD} lift relative ${CARD_FOCUS} flex scroll-mt-6 flex-col overflow-hidden px-7 pt-7 ${shot ? "" : "pb-7"} ${className}`}>
			<div className="flex items-center justify-between gap-3">
				<p className={`${EYEBROW} text-muted`}>{projectNumber(number)}</p>
				<StatusPill status={project.status} up={project.up} />
			</div>
			<h2 className={`mt-3 text-[2.125rem] leading-[1.1] ${HEADING}`}>
				{project.siteUrl ? (
					<a href={project.siteUrl} target="_blank" rel="noopener noreferrer" data-card-link className={STRETCHED_LINK}>
						{project.name}
						{NEW_TAB}
					</a>
				) : (
					project.name
				)}
			</h2>
			<p className="mt-2 text-[16px] leading-normal text-ink-2">{project.tagline}</p>
			{shot && project.screenshot && (
				// Edge to edge (out of the card's 28px side padding), at the bottom when the row makes the card taller.
				<div className="-mx-7 mt-auto pt-5">
					{/* eslint-disable-next-line @next/next/no-img-element -- static WebP with srcset, from npm run build:images */}
					<img
						src={shot.src}
						srcSet={shot.srcSet}
						sizes="(min-width: 1248px) 592px, (min-width: 1024px) 48vw, calc(100vw - 48px)"
						width={shot.width}
						height={shot.height}
						alt={project.screenshot.alt}
						loading="lazy"
						className="block h-auto w-full"
					/>
				</div>
			)}
		</article>
	);
}

/** What I'm working on this week (content/now.ts), with a progress bar when it has one. */
export function NowCard({ className }: { className: string }) {
	const progress = now.progress && Number.isFinite(now.progress.percent) ? { ...now.progress, percent: Math.max(0, Math.min(100, Math.round(now.progress.percent))) } : null;
	return (
		<section aria-labelledby="now-heading" className={`${CARD} flex min-h-[300px] flex-col p-7 sm:p-9 ${className}`}>
			<p className={`${EYEBROW} text-muted`}>Now</p>
			<h2 id="now-heading" className={`mt-4 max-w-[460px] text-[clamp(1.875rem,7vw,2.125rem)] leading-[1.15] ${HEADING}`}>
				{now.title}
			</h2>
			<p className="mt-4 max-w-[620px] text-[17px] leading-relaxed text-ink-2">{now.text}</p>
			{progress && (
				<div className="mt-auto pt-10">
					<div className="flex items-baseline justify-between gap-4 text-[15px] font-medium">
						<span id="now-progress">{progress.label}</span>
						<span className="tabular">{progress.percent}%</span>
					</div>
					<div role="progressbar" aria-labelledby="now-progress" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} className="mt-3 h-2.5 overflow-hidden rounded-full bg-track">
						<div className="h-full rounded-full bg-accent" style={{ width: `${progress.percent}%` }} />
					</div>
				</div>
			)}
		</section>
	);
}

/** GitHub activity: the live contribution grid, with the year's total and longest streak. */
export function GitHubCard({ github, className }: { github: PublicGithub | null; className: string }) {
	return (
		<section aria-labelledby="github-heading" className={`${CARD} p-7 sm:p-8 ${className}`}>
			<div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
				<h2 id="github-heading" className={`text-2xl ${HEADING}`}>
					GitHub activity
				</h2>
				{github && (
					<p className="text-[15px] text-muted">
						<strong className="tabular font-semibold text-ink">{formatWhole(github.total)}</strong> contributions in the last year
						<span aria-hidden> · </span>
						longest streak <strong className="tabular font-semibold text-ink">{formatWhole(github.longestStreak)}</strong> day{github.longestStreak === 1 ? "" : "s"}
					</p>
				)}
			</div>
			<div className="mt-6">{github ? <ContributionGrid firstDay={github.firstDay} counts={github.counts} /> : <p className="text-[15px] text-muted">No GitHub activity to show yet.</p>}</div>
		</section>
	);
}

/** A journey entry's date and type in small mono capitals ("9 Nov · Decision"). */
export function EntryMeta({ post }: { post: JourneyPost }) {
	return (
		<span className={`${EYEBROW} block leading-4 text-muted`}>
			<time dateTime={post.day}>{formatDay(post.day)}</time>
			<span aria-hidden> · </span>
			{journeyType(post.type).label}
		</span>
	);
}

/** The 3 newest journey entries, each opening its post, then "See the full journey". */
export function LatestJourneyCard({ posts, className }: { posts: JourneyPost[]; className: string }) {
	return (
		<section aria-labelledby="latest-heading" className={`${CARD} p-7 sm:p-8 ${className}`}>
			<h2 id="latest-heading" className={`text-2xl ${HEADING}`}>
				Latest from the journey
			</h2>
			<ul className="mt-4 space-y-2">
				{posts.slice(0, 3).map((p) => (
					<li key={p.slug}>
						<Link href={postHref(p.slug)} className="group -mx-2 block rounded-xl px-2 py-0.5">
							<EntryMeta post={p} />
							<span className="mt-1 block text-[17px] font-semibold leading-snug text-ink underline-offset-4 group-hover:text-accent group-hover:underline">{p.title}</span>
						</Link>
					</li>
				))}
			</ul>
			<Link href="/journey" className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-[17px] font-semibold text-ink underline underline-offset-4 hover:text-accent">
				See the full journey <Arrow />
			</Link>
		</section>
	);
}
