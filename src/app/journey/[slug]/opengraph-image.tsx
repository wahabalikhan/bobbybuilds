import { journeyType } from "@/lib/journey-types";
import { getSnapshot } from "@/lib/public/get";
import { findPost, journeyPosts } from "@/lib/public/journey";
import { shareImage, shareImageSize } from "@/lib/public/share-image";
import { site } from "@/lib/site";

export const size = shareImageSize;
export const contentType = "image/png";
export const alt = `A journey entry on ${site.name}`;
export const dynamic = "force-dynamic";

/** A journey post's share card: blue like its header, with its type, title and the start of its text. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const found = findPost(journeyPosts(await getSnapshot()), slug);
	if (!found) return shareImage({ eyebrow: "Journey", title: site.name });
	const { post } = found;
	const subtitle = post.summary.length > 110 ? `${post.summary.slice(0, 109).replace(/\s+\S*$/, "")}…` : post.summary;
	return shareImage({
		blue: true,
		eyebrow: [`Journey · ${journeyType(post.type).label}`, post.projectName].filter(Boolean).join(" · "),
		title: post.title,
		subtitle: post.title.length > 60 ? undefined : subtitle,
		pill: `${post.readingMinutes} min read`,
	});
}
