import { imageSet, type ImageSet } from "@/lib/images";
import { POSTS } from "@/lib/journey-posts.generated";
import { renderMarkdown } from "@/lib/markdown";
import { fillText, taglineKeys } from "./product-line";
import type { PublicEntry, PublicProject, PublicSnapshot } from "./snapshot";

/**
 * A published journey entry with its post (content/journey/<slug>.md, optional): the entry's text is
 * the summary, and the post adds a hero image, "The numbers" and a long-form body. Built from the
 * snapshot and the post files only.
 */
export type JourneyPost = PublicEntry & {
	/** The entry's text as plain text, for cards and descriptions. */
	summary: string;
	image: (ImageSet & { alt: string }) | null;
	/** "The numbers": live ones ({key}, filled from the entry's project) come last, after a line. */
	numbers: { label: string; value: string; live: boolean }[];
	/** The post's body as safe HTML, "" when there's none (the page then shows just the summary). */
	bodyHtml: string;
	readingMinutes: number;
	/** The entry's project, when it's on the public page. */
	project: PublicProject | null;
};

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

/** Safe HTML to plain text. */
function plainText(html: string): string {
	return html
		.replace(/<[^>]+>/g, " ")
		.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m])
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * The post's Markdown with {numbers} filled from its project. A paragraph whose numbers can't be
 * filled (private, missing or over 7 days old) is left out, so a sentence never shows a {key}.
 */
function fillBody(markdown: string, project: PublicProject | null, today: string): string {
	return markdown
		.split(/\n\s*\n/)
		.map((block) => (taglineKeys(block).length ? fillText(block, project?.numbers ?? [], today) : block))
		.filter((block): block is string => block !== null)
		.join("\n\n");
}

/** Every published entry as a post, newest first (the snapshot's order). */
export function journeyPosts(snapshot: PublicSnapshot): JourneyPost[] {
	return snapshot.journey.map((entry) => {
		const source = POSTS[entry.slug];
		const project = snapshot.projects.find((p) => p.slug === entry.projectSlug) ?? null;
		const image = imageSet(source?.image);
		const bodyHtml = source?.body ? renderMarkdown(fillBody(source.body, project, snapshot.today)) : "";
		const numbers = (source?.numbers ?? [])
			.map((n) => ({ label: n.label, value: fillText(n.value, project?.numbers ?? [], snapshot.today), live: taglineKeys(n.value).length > 0 }))
			.filter((n): n is { label: string; value: string; live: boolean } => n.value !== null)
			.sort((a, b) => Number(a.live) - Number(b.live));
		const summary = plainText(entry.html);
		const words = `${summary} ${plainText(bodyHtml)}`.split(/\s+/).filter(Boolean).length;
		return {
			...entry,
			summary,
			image: image && source ? { ...image, alt: source.imageAlt } : null,
			numbers,
			bodyHtml,
			readingMinutes: Math.max(1, Math.ceil(words / 200)),
			project,
		};
	});
}

/** The post with this slug, with the one before it (older) and after it (newer). */
export function findPost(posts: JourneyPost[], slug: string): { post: JourneyPost; previous: JourneyPost | null; next: JourneyPost | null } | null {
	const i = posts.findIndex((p) => p.slug === slug);
	if (i < 0) return null;
	return { post: posts[i], previous: posts[i + 1] ?? null, next: posts[i - 1] ?? null };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "November 2026" from 'YYYY-MM-DD'. */
export function monthName(day: string): string {
	return `${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;
}

/** Posts (already newest first) in runs of the same month. */
export function byMonth<T extends { day: string }>(posts: T[]): { month: string; posts: T[] }[] {
	const groups: { month: string; posts: T[] }[] = [];
	for (const p of posts) {
		const month = p.day.slice(0, 7);
		if (groups.at(-1)?.month === month) groups.at(-1)!.posts.push(p);
		else groups.push({ month, posts: [p] });
	}
	return groups;
}

/**
 * A post's address. With `type` (the journey filter it was opened from, /journey?type=decision) it
 * carries ?type=, so the post's "All entries" link goes back to that filter. The canonical address
 * never has it.
 */
export const postHref = (slug: string, type?: string | null) => `/journey/${slug}${type ? `?type=${encodeURIComponent(type)}` : ""}`;
