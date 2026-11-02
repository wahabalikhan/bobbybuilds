import { pillText } from "@/components/public/project-card";
import { getSnapshot } from "@/lib/public/get";
import { shareImage, shareImageSize } from "@/lib/public/share-image";

export const size = shareImageSize;
export const contentType = "image/png";
export const alt = "Project share card";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const project = (await getSnapshot()).projects.find((p) => p.slug === slug);
	if (!project) return shareImage({ eyebrow: "Not found", title: "This project doesn't exist" });
	const status = { live: "Live", building: "Building", idea: "Idea", retired: "Retired" }[project.status];
	return shareImage({ eyebrow: `Project · ${status}`, title: project.name, subtitle: project.tagline, pill: project.pill ? pillText(project.pill) : undefined });
}
