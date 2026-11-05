import { formatWhole } from "@/lib/format";
import { getSnapshot } from "@/lib/public/get";
import { shareImage, shareImageSize } from "@/lib/public/share-image";
import { homeTitle, owner } from "@/lib/site";

export const size = shareImageSize;
export const contentType = "image/png";
export const alt = homeTitle;
export const dynamic = "force-dynamic";

export default async function Image() {
	const snapshot = await getSnapshot();
	const total = snapshot.monthly.reduce((t, m) => t + m.value, 0);
	const live = snapshot.projects.filter((p) => ["live", "building", "paused"].includes(p.status)).length;
	return shareImage({
		eyebrow: `${live} project${live === 1 ? "" : "s"}, built in public`,
		title: owner.name,
		subtitle: owner.bio,
		pill: total > 0 ? `${formatWhole(total)} visitors in 12 months` : undefined,
	});
}
