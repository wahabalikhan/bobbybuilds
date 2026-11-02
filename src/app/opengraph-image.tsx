import { formatWhole } from "@/lib/format";
import { getSnapshot } from "@/lib/public/get";
import { shareImage, shareImageSize } from "@/lib/public/share-image";
import { owner } from "@/lib/site";

export const size = shareImageSize;
export const contentType = "image/png";
export const alt = `${owner.name}: free, honest tools, built in public`;
export const dynamic = "force-dynamic";

export default async function Image() {
	const snapshot = await getSnapshot();
	const total = snapshot.monthly.reduce((t, m) => t + m.value, 0);
	const live = snapshot.projects.filter((p) => p.status === "live" || p.status === "building").length;
	return shareImage({
		eyebrow: `${live} project${live === 1 ? "" : "s"}, built in public`,
		title: owner.name,
		subtitle: `Product designer from ${owner.location}, building free tools that are honest about what they do.`,
		pill: total > 0 ? `${formatWhole(total)} visitors in 12 months` : undefined,
	});
}
