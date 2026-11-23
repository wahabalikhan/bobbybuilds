import Link from "next/link";
import { formatDay } from "@/lib/format";
import { CARD, EYEBROW } from "@/lib/layout";
import { postHref, type JourneyPost } from "@/lib/public/journey";
import { owner } from "@/lib/site";
import { Arrow, CARD_FOCUS, NEW_TAB, Pill, pillButton, STRETCHED_LINK, TypePill } from "./bits";

const HEADING = "font-extrabold tracking-[-0.035em]";

/** The entry's date in small mono figures ("9 Nov", or "6 Nov 2026" with the year). */
function EntryDate({ post, withYear = false, className = "text-muted" }: { post: JourneyPost; withYear?: boolean; className?: string }) {
	return (
		<time dateTime={post.day} className={`font-mono text-[14px] tracking-[0.02em] ${className}`}>
			{formatDay(post.day, withYear)}
		</time>
	);
}

/** A screenshot from npm run build:images, with its srcset. */
function Screenshot({ post, sizes, className }: { post: JourneyPost; sizes: string; className: string }) {
	const image = post.image!;
	// eslint-disable-next-line @next/next/no-img-element -- static WebP with srcset
	return <img src={image.src} srcSet={image.srcSet} sizes={sizes} width={image.width} height={image.height} alt={image.alt} loading="lazy" className={className} />;
}

/**
 * The featured entry (the newest with an image): blue, 2 columns by 2 rows on desktop, with its type
 * and project, date, title, text, "Read the post" and its screenshot cut off by the card's bottom edge.
 */
export function FeaturedEntryCard({ post, type = null }: { post: JourneyPost; type?: string | null }) {
	return (
		<article className={`lift relative ${CARD_FOCUS} flex flex-col overflow-hidden rounded-[28px] bg-accent px-7 pt-7 text-white sm:px-10 sm:pt-10 md:col-span-2 md:row-span-2`}>
			<div className="flex flex-wrap items-center gap-x-2 gap-y-3">
				<TypePill type={post.type} onBlue />
				{post.projectName && <Pill onBlue>{post.projectName}</Pill>}
				<EntryDate post={post} withYear className="basis-full text-on-accent-2 sm:ml-2 sm:basis-auto" />
			</div>
			<h3 className={`mt-5 max-w-[700px] text-[clamp(2rem,7vw,2.75rem)] leading-[1.05] ${HEADING}`}>
				<Link href={postHref(post.slug, type)} data-card-link className={STRETCHED_LINK}>
					{post.title}
				</Link>
			</h3>
			<p className="mt-4 max-w-[720px] text-[17px] leading-relaxed text-on-accent-2 sm:text-lg">{post.summary}</p>
			<p aria-hidden className="mt-5 inline-flex items-center gap-1.5 text-[17px] font-bold">
				Read the post <Arrow />
			</p>
			<div className="relative mt-8 min-h-[220px] flex-1 overflow-hidden rounded-t-[16px] bg-white sm:min-h-[300px]">
				<Screenshot post={post} sizes="(min-width: 1024px) 720px, calc(100vw - 104px)" className="absolute inset-0 h-full w-full object-cover object-left-top" />
			</div>
		</article>
	);
}

/** An entry: its type pill and date, title, text (up to 4 lines) and "Read". The whole card opens its post (with `type`, the journey filter it's shown under). */
export function EntryCard({ post, type = null }: { post: JourneyPost; type?: string | null }) {
	return (
		<article className={`${CARD} lift relative ${CARD_FOCUS} flex min-h-[220px] flex-col p-7`}>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				<TypePill type={post.type} />
				<EntryDate post={post} />
			</div>
			<h3 className={`mt-4 text-[1.625rem] leading-[1.15] ${HEADING}`}>
				<Link href={postHref(post.slug, type)} data-card-link className={STRETCHED_LINK}>
					{post.title}
				</Link>
			</h3>
			<p className="mt-3 line-clamp-4 text-[16px] leading-relaxed text-ink-2">{post.summary}</p>
			<p aria-hidden className="mt-auto inline-flex items-center gap-1.5 pt-5 text-[16px] font-semibold">
				Read <Arrow />
			</p>
		</article>
	);
}

/** An entry with an image and nothing beside it in its month: full width, the screenshot on the left (on top on phones). */
export function WideEntryCard({ post, type = null }: { post: JourneyPost; type?: string | null }) {
	return (
		<article className={`${CARD} lift relative ${CARD_FOCUS} flex flex-col gap-6 p-5 sm:p-7 md:col-span-3 md:flex-row md:items-center md:gap-8`}>
			<div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-[16px] border border-line md:w-[320px]">
				<Screenshot post={post} sizes="(min-width: 768px) 320px, calc(100vw - 90px)" className="absolute inset-0 h-full w-full object-cover object-left-top" />
			</div>
			<div className="min-w-0 px-2 pb-2 md:px-0 md:pb-0">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
					<TypePill type={post.type} />
					<EntryDate post={post} />
				</div>
				<h3 className={`mt-4 text-[1.625rem] leading-[1.15] ${HEADING}`}>
					<Link href={postHref(post.slug, type)} data-card-link className={STRETCHED_LINK}>
						{post.title}
					</Link>
				</h3>
				<p className="mt-3 line-clamp-3 text-[16px] leading-relaxed text-ink-2">{post.summary}</p>
			</div>
		</article>
	);
}

/** A dashed card inviting people to follow along on X and LinkedIn for the next entry. */
export function NextEntryCard() {
	const links = (["X", "LinkedIn"] as const).map((label) => owner.links.find((l) => l.label === label)!);
	return (
		<aside aria-labelledby="next-entry" className="flex min-h-[220px] flex-col justify-center rounded-[28px] border-2 border-dashed border-[#d3d7e0] p-7">
			<p className={`${EYEBROW} text-muted`}>Next entry</p>
			<h3 id="next-entry" className="mt-2 text-[1.25rem] font-bold tracking-[-0.02em]">
				Follow along for the next update
			</h3>
			<ul className="mt-4 flex flex-wrap gap-2">
				{links.map((l) => (
					<li key={l.url}>
						<a href={l.url} target="_blank" rel="noopener noreferrer me" className={`${pillButton("white")} border border-line`}>
							{l.label}
							{NEW_TAB}
						</a>
					</li>
				))}
			</ul>
		</aside>
	);
}
