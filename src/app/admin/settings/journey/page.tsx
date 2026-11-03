import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { buttonClass, Empty, Pill } from "@/components/admin/ui";
import { listProjects } from "@/lib/db/projects";
import { listJourney } from "@/lib/db/settings";
import { formatDay } from "@/lib/format";
import { AdminNotFoundMessage } from "@/components/admin/not-found-message";
import { adminHref, site } from "@/lib/site";

export default async function JourneyList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
	// Hidden until the journey comes back (site.showJourney); the code and table stay. Shown as
	// "not found" inside the admin layout, like any unknown admin address.
	if (!site.showJourney) return <AdminNotFoundMessage />;
	const { env } = await getCloudflareContext({ async: true });
	const [entries, projects, params] = await Promise.all([listJourney(env.DB), listProjects(env.DB), searchParams]);
	const projectName = new Map(projects.map((p) => [p.id, p.name]));

	return (
		<div className="max-w-3xl space-y-6">
			<div>
				<Link href={adminHref("/settings")} className="text-sm text-muted hover:text-ink">
					← Settings
				</Link>
				<div className="mt-2 flex flex-wrap items-center justify-between gap-3">
					<h1 className="text-2xl font-semibold tracking-tight">Journey</h1>
					<Link href={adminHref("/settings/journey/new")} className={buttonClass}>
						New entry
					</Link>
				</div>
			</div>
			{params.deleted && <p role="status" className="text-sm text-good-ink">✓ The entry was deleted.</p>}
			{entries.length === 0 ? (
				<Empty>No entries yet. Write your first build-in-public update.</Empty>
			) : (
				<ul className="divide-y divide-line rounded-2xl border border-line bg-card">
					{entries.map((e) => (
						<li key={e.id}>
							<Link href={adminHref(`/settings/journey/${e.id}`)} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-surface">
								<span>
									<span className="font-medium">{e.title}</span>
									<span className="block text-sm text-muted">
										{e.projectId ? projectName.get(e.projectId) ?? "Unknown project" : "General"} · {e.isPublished && e.publishedAt ? `Published ${formatDay(new Date(e.publishedAt).toISOString().slice(0, 10), true)}` : "Draft"}
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
