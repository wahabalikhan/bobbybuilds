import type { Metadata } from "next";
import Link from "next/link";
import { Empty, Pill } from "@/components/admin/ui";
import { SiteHeader, SkipLink } from "@/components/public/site-header";
import { formatDay } from "@/lib/format";
import { getSnapshot } from "@/lib/public/get";
import { owner } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Journey",
	description: `${owner.firstName}'s build-in-public updates, newest first.`,
	alternates: { canonical: "/journey" },
};

export default async function JourneyPage() {
	const { journey } = await getSnapshot();
	return (
		<>
			<SkipLink />
			<SiteHeader />
			<main id="content" className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
				<h1 className="text-3xl font-bold tracking-tight">Journey</h1>
				<p className="mt-2 text-ink-2">Building in public: what I shipped, what I learned, and what&rsquo;s next. Newest first.</p>
				<div className="mt-10">
					{journey.length === 0 ? (
						<Empty>Nothing published yet. Check back soon.</Empty>
					) : (
						<ol className="space-y-4">
							{journey.map((e) => (
								<li key={e.slug}>
									<article className="rounded-2xl border border-line bg-card p-5">
										<p className="flex flex-wrap items-center gap-2 text-sm text-muted">
											<time dateTime={new Date(e.publishedAt).toISOString()}>{formatDay(new Date(e.publishedAt).toISOString().slice(0, 10), true)}</time>
											{e.projectName && e.projectSlug && (
												<Link href={`/p/${e.projectSlug}`}>
													<Pill>{e.projectName}</Pill>
												</Link>
											)}
										</p>
										<h2 className="mt-1 text-lg font-semibold tracking-tight">
											<Link href={`/journey/${e.slug}`} className="hover:underline">
												{e.title}
											</Link>
										</h2>
										{e.excerpt && <p className="mt-1 text-ink-2">{e.excerpt}</p>}
										<Link href={`/journey/${e.slug}`} className="link mt-3 inline-block text-sm">
											Read the entry<span className="sr-only">: {e.title}</span>
										</Link>
									</article>
								</li>
							))}
						</ol>
					)}
				</div>
			</main>
		</>
	);
}
