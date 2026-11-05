import type { Metadata } from "next";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Breadcrumb, buttonClass, Empty, Pill } from "@/components/admin/ui";
import { listProjects } from "@/lib/db/projects";
import { listJourney } from "@/lib/db/settings";
import { formatDay } from "@/lib/format";
import { journeyType } from "@/lib/journey-types";
import { adminHref } from "@/lib/site";

export const metadata: Metadata = { title: "Journey" };

/** The journey: short, dated entries for the public timeline, newest first. */
export default async function JourneyList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
	const { env } = await getCloudflareContext({ async: true });
	const [entries, projects, params] = await Promise.all([listJourney(env.DB), listProjects(env.DB), searchParams]);
	const projectName = new Map(projects.map((p) => [p.id, p.name]));

	return (
		<div className="max-w-3xl space-y-6">
			<div className="space-y-3">
				<Breadcrumb items={[{ label: "Home", href: adminHref() }, { label: "Journey" }]} />
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h1 className="text-2xl font-semibold tracking-tight">Journey</h1>
					<Link href={adminHref("/settings/journey/new")} className={buttonClass}>
						New entry
					</Link>
				</div>
			</div>
			{params.deleted && <p role="status" className="text-sm text-good-ink">✓ The entry was deleted.</p>}
			{entries.length === 0 ? (
				<Empty>No entries yet. Add the first thing you shipped, decided or learned.</Empty>
			) : (
				<ul className="divide-y divide-line rounded-2xl border border-line bg-card">
					{entries.map((e) => (
						<li key={e.id}>
							<Link href={adminHref(`/settings/journey/${e.id}`)} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-surface">
								<span className="flex min-w-0 items-start gap-3">
									<span aria-hidden className="text-lg leading-6">
										{journeyType(e.type).emoji}
									</span>
									<span className="min-w-0">
										<span className="font-medium">{e.title}</span>
										<span className="block text-sm text-muted">
											{[
												journeyType(e.type).label,
												e.publishedAt ? formatDay(new Date(e.publishedAt).toISOString().slice(0, 10), true) : null,
												e.projectId ? projectName.get(e.projectId) ?? "Unknown project" : null,
											]
												.filter(Boolean)
												.join(" · ")}
										</span>
									</span>
								</span>
								<Pill>{e.isPublished ? "Published" : "Draft"}</Pill>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
