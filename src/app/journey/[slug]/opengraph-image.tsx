import { formatDay } from "@/lib/format";
import { getSnapshot } from "@/lib/public/get";
import { shareImage, shareImageSize } from "@/lib/public/share-image";

export const size = shareImageSize;
export const contentType = "image/png";
export const alt = "Journey entry share card";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const entry = (await getSnapshot()).journey.find((e) => e.slug === slug);
	if (!entry) return shareImage({ eyebrow: "Not found", title: "This entry doesn't exist" });
	return shareImage({
		eyebrow: `Journey · ${formatDay(new Date(entry.publishedAt).toISOString().slice(0, 10), true)}${entry.projectName ? ` · ${entry.projectName}` : ""}`,
		title: entry.title,
		subtitle: entry.excerpt.length > 120 ? `${entry.excerpt.slice(0, 117)}…` : entry.excerpt,
	});
}
