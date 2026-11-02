import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pill } from "@/components/admin/ui";
import { SiteHeader, SkipLink } from "@/components/public/site-header";
import { formatDay } from "@/lib/format";
import { getSnapshot } from "@/lib/public/get";
import { owner } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
	const { slug } = await params;
	const entry = (await getSnapshot()).journey.find((e) => e.slug === slug);
	if (!entry) return { title: "Not found" };
	return { title: entry.title, description: entry.excerpt || `A journey entry by ${owner.name}.`, alternates: { canonical: `/journey/${entry.slug}` }, openGraph: { type: "article", publishedTime: new Date(entry.publishedAt).toISOString() } };
}

export default async function JourneyEntry({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const entry = (await getSnapshot()).journey.find((e) => e.slug === slug);
	if (!entry) notFound();
	return (
		<>
			<SkipLink />
			<SiteHeader />
			<main id="content" className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
				<Link href="/journey" className="text-sm text-muted hover:text-ink">
					← Journey
				</Link>
				<article className="mt-4">
					<header>
						<p className="flex flex-wrap items-center gap-2 text-sm text-muted">
							<time dateTime={new Date(entry.publishedAt).toISOString()}>{formatDay(new Date(entry.publishedAt).toISOString().slice(0, 10), true)}</time>
							{entry.projectName && entry.projectSlug && (
								<Link href={`/p/${entry.projectSlug}`}>
									<Pill>{entry.projectName}</Pill>
								</Link>
							)}
						</p>
						<h1 className="mt-2 text-3xl font-bold tracking-tight">{entry.title}</h1>
					</header>
					{/* Safe: rendered by src/lib/markdown.ts, which never passes raw HTML through. */}
					<div className="prose-bobby mt-8 text-[17px]" dangerouslySetInnerHTML={{ __html: entry.html }} />
				</article>
			</main>
		</>
	);
}
