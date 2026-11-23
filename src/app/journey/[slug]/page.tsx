import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Arrow, ArrowLeft, ArrowOut, CARD_FOCUS, NEW_TAB, Pill, pillButton, STRETCHED_LINK, TypePill } from "@/components/public/bits";
import { JOURNEY_TYPES } from "@/lib/journey-types";
import { SiteFooter } from "@/components/public/footer";
import { EntryMeta } from "@/components/public/home";
import { SiteHeader, SkipLink } from "@/components/public/site-header";
import { PublicTracker } from "@/components/public/tracker";
import { formatDay } from "@/lib/format";
import { CARD, CARD_SMALL, EYEBROW, PUBLIC_PAGE } from "@/lib/layout";
import { getSnapshot } from "@/lib/public/get";
import { findPost, journeyPosts, postHref, type JourneyPost } from "@/lib/public/journey";
import { site } from "@/lib/site";

// Reads the public snapshot (rebuilt from the roll-ups every 10 minutes) on each request.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ type?: string | string[] }> };

/** Up to `max` characters, cut at a word, for descriptions. */
function clip(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…` : text;
}

/** The post's tab title, description and share card (its share image is ./opengraph-image.tsx). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params;
	const found = findPost(journeyPosts(await getSnapshot()), slug);
	if (!found) return { title: "Page not found" };
	const { post } = found;
	const description = clip(post.summary, 160);
	return {
		title: post.title,
		description,
		alternates: { canonical: postHref(post.slug) },
		openGraph: { type: "article", title: post.title, description, url: postHref(post.slug), publishedTime: new Date(post.publishedAt).toISOString() },
		twitter: { title: post.title, description },
	};
}

function domain(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

/** "The numbers" in a dark card: plain ones first, then (after a line) the live ones in light blue. */
function NumbersCard({ numbers }: { numbers: JourneyPost["numbers"] }) {
	const firstLive = numbers.findIndex((n) => n.live);
	return (
		<section aria-labelledby="numbers-heading" className="rounded-[24px] bg-ink p-7 text-white">
			<h2 id="numbers-heading" className={`${EYEBROW} text-white/70`}>
				The numbers
			</h2>
			<dl className="mt-3">
				{numbers.map((n, i) => (
					<div key={n.label} className={`flex items-baseline justify-between gap-4 py-3 ${i === firstLive && i > 0 ? "mt-2 border-t border-white/15 pt-5" : ""}`}>
						<dt className="text-[16px] text-white/80">{n.label}</dt>
						<dd className={`tabular text-[2.25rem] font-extrabold leading-none tracking-[-0.035em] ${n.live ? "text-on-accent-soft" : ""}`}>{n.value}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}

/** The entry's project: its icon, name and tagline, opening its site. */
function ProjectCardSmall({ post }: { post: JourneyPost }) {
	const project = post.project!;
	return (
		<article className={`${CARD_SMALL} lift relative ${CARD_FOCUS} flex items-center gap-4 p-6`}>
			{project.logoPath ? (
				// eslint-disable-next-line @next/next/no-img-element -- a small local icon
				<img src={project.logoPath} alt="" width={56} height={56} className="h-14 w-14 shrink-0 object-contain" />
			) : (
				<span aria-hidden className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-accent text-2xl font-bold text-white">
					{project.name.slice(0, 1)}
				</span>
			)}
			<div className="min-w-0">
				<h2 className="text-[18px] font-bold tracking-[-0.02em]">
					{project.siteUrl ? (
						<a href={project.siteUrl} target="_blank" rel="noopener noreferrer" data-card-link className={`${STRETCHED_LINK} hover:text-accent`}>
							{project.name}
							{NEW_TAB}
						</a>
					) : (
						project.name
					)}
				</h2>
				{project.pitch && <p className="mt-0.5 text-[15px] leading-snug text-muted">{project.pitch}</p>}
			</div>
		</article>
	);
}

/** One of the previous and next links at the bottom (keeping the journey filter the visitor came from). */
function Neighbour({ post, direction, type }: { post: JourneyPost | null; direction: "previous" | "next"; type: string | null }) {
	if (!post) return <div className="hidden sm:block" />;
	const next = direction === "next";
	return (
		<Link href={postHref(post.slug, type)} rel={next ? "next" : "prev"} className={`${CARD_SMALL} lift block p-6 ${next ? "text-right" : ""}`}>
			<span className={`inline-flex items-center gap-1.5 text-[15px] text-muted ${next ? "flex-row-reverse" : ""}`}>
				{next ? <Arrow /> : <ArrowLeft />}
				{next ? "Next" : "Previous"}
			</span>
			<span className="mt-1.5 block text-[18px] font-bold leading-snug tracking-[-0.02em]">{post.title}</span>
		</Link>
	);
}

/**
 * A journey entry's own page: a blue header card (type and project, date and reading time, title,
 * the entry's text and the hero image), the post in a large white card with the project and share
 * links at the end, a sidebar (The numbers, the project, More from the journey) and the previous and
 * next entries. The post comes from content/journey/<slug>.md; without one, the page shows the entry's text.
 */
export default async function JourneyPostPage({ params, searchParams }: Props) {
	const [{ slug }, query] = await Promise.all([params, searchParams]);
	// The journey filter the visitor came from (/journey?type=decision), when it's a real type.
	const type = JOURNEY_TYPES.find((t) => t.value === query.type)?.value ?? null;
	const snapshot = await getSnapshot();
	const posts = journeyPosts(snapshot);
	const found = findPost(posts, slug);
	if (!found) notFound();
	const { post, previous, next } = found;
	const more = posts.filter((p) => p !== post).slice(0, 3);
	const url = `${site.url}${postHref(post.slug)}`;
	const visit = post.project?.siteUrl ? { href: post.project.siteUrl, label: `Try ${post.project.name}` } : post.linkUrl ? { href: post.linkUrl, label: `Visit ${domain(post.linkUrl)}` } : null;
	const share = [
		{ label: "Share on X", href: `https://x.com/intent/post?${new URLSearchParams({ text: post.title, url })}` },
		{ label: "Share on LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url })}` },
	];

	return (
		<div className="public-theme min-h-screen bg-page font-sans text-ink">
			<PublicTracker />
			<SkipLink />
			<SiteHeader current="journey" />
			<main id="content" className={PUBLIC_PAGE}>
				<Link
					href={type ? `/journey?type=${type}` : "/journey"}
					className="-ml-2 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-[15px] font-medium text-ink underline-offset-4 hover:text-accent hover:underline"
				>
					<ArrowLeft />
					All entries
				</Link>
				<header className={`overflow-hidden rounded-[28px] bg-accent px-7 pt-8 text-white sm:px-12 sm:pt-12 ${post.image ? "" : "pb-10 sm:pb-12"}`}>
					<div className="flex flex-wrap items-center gap-x-2 gap-y-3">
						<TypePill type={post.type} onBlue />
						{post.projectName && <Pill onBlue>{post.projectName}</Pill>}
						<p className="basis-full font-mono text-[14px] tracking-[0.02em] text-on-accent-2 sm:ml-2 sm:basis-auto">
							<time dateTime={post.day}>{formatDay(post.day, true)}</time>
							<span aria-hidden> · </span>
							{post.readingMinutes} min read
						</p>
					</div>
					<h1 className="mt-5 max-w-[960px] text-[clamp(2.375rem,8vw,4rem)] font-extrabold leading-[1.02] tracking-[-0.035em]">{post.title}</h1>
					<p className="mt-5 max-w-[780px] text-[17px] leading-relaxed text-on-accent-2 sm:text-[19px]">{post.summary}</p>
					{post.image && (
						<div className="relative mt-10 h-[240px] overflow-hidden rounded-t-[20px] bg-white sm:h-[420px]">
							{/* eslint-disable-next-line @next/next/no-img-element -- static WebP with srcset */}
							<img
								src={post.image.src}
								srcSet={post.image.srcSet}
								sizes="(min-width: 1248px) 1104px, calc(100vw - 104px)"
								width={post.image.width}
								height={post.image.height}
								alt={post.image.alt}
								fetchPriority="high"
								className="absolute inset-0 h-full w-full object-cover object-left-top"
							/>
						</div>
					)}
				</header>

				<div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
					<article className={`${CARD} p-7 sm:p-12 lg:col-span-2`}>
						{post.bodyHtml ? (
							<div className="post-body" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
						) : (
							<div className="post-body" dangerouslySetInnerHTML={{ __html: post.html }} />
						)}
						<div className="mt-10 flex flex-wrap gap-2 border-t border-line pt-6">
							{visit && (
								<a href={visit.href} target="_blank" rel="noopener noreferrer" className={`${pillButton("blue")} font-semibold`}>
									{visit.label}
									<ArrowOut />
									{NEW_TAB}
								</a>
							)}
							{share.map((s) => (
								<a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className={`${pillButton("quiet")} font-semibold`}>
									{s.label}
									{NEW_TAB}
								</a>
							))}
						</div>
					</article>

					<div className="flex flex-col gap-4">
						{post.numbers.length > 0 && <NumbersCard numbers={post.numbers} />}
						{post.project && <ProjectCardSmall post={post} />}
						{more.length > 0 && (
							<section aria-labelledby="more-heading" className={`${CARD_SMALL} p-7`}>
								<h2 id="more-heading" className={`${EYEBROW} text-muted`}>
									More from the journey
								</h2>
								<ul className="mt-3 space-y-1">
									{more.map((p) => (
										<li key={p.slug}>
											<Link href={postHref(p.slug, type)} className="group -mx-2 block rounded-xl px-2 py-2">
												<EntryMeta post={p} />
												<span className="mt-1 block text-[16px] font-semibold leading-snug group-hover:text-accent group-hover:underline group-hover:underline-offset-4">{p.title}</span>
											</Link>
										</li>
									))}
								</ul>
							</section>
						)}
					</div>
				</div>

				{(previous || next) && (
					<nav aria-label="More entries" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
						<Neighbour post={previous} direction="previous" type={type} />
						<Neighbour post={next} direction="next" type={type} />
					</nav>
				)}
			</main>
			<SiteFooter year={Number(snapshot.today.slice(0, 4))} />
		</div>
	);
}
