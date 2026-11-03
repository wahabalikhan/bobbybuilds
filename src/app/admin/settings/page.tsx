import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { buttonClass, ProjectLogo, SectionHeading, StatusPill } from "@/components/admin/ui";
import { isConnected, listRealProjects, projectsWithVisits } from "@/lib/db/projects";
import { logoFor } from "@/lib/project-logo";
import { adminHref } from "@/lib/site";

/** Projects, each with a "connected" tick (keys made and data has arrived). Test projects are left out. */
export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
	const { env } = await getCloudflareContext({ async: true });
	const [projects, withVisits, params] = await Promise.all([listRealProjects(env.DB), projectsWithVisits(env.DB), searchParams]);

	return (
		<div className="space-y-10">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
				<Link href={adminHref("/settings/projects/new")} className={buttonClass}>
					New project
				</Link>
			</div>
			{params.deleted && (
				<p role="status" className="text-sm text-good-ink">
					✓ The project was deleted.
				</p>
			)}

			<section aria-labelledby="projects-heading">
				<SectionHeading id="projects-heading" aside={projects.length}>
					Projects
				</SectionHeading>
				{projects.length === 0 ? (
					<p className="text-sm text-muted">No projects yet. Add one with New project.</p>
				) : (
					<ul className="divide-y divide-line rounded-2xl border border-line bg-card">
						{projects.map((p) => {
							const connected = isConnected(p, withVisits);
							return (
								<li key={p.id}>
									<Link href={adminHref(`/settings/projects/${p.slug}`)} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-surface">
										<span className="flex min-w-0 items-center gap-3">
											<ProjectLogo name={p.name} logoPath={logoFor(p)} />
											<span className="font-medium">{p.name}</span>
											<StatusPill status={p.status} />
										</span>
										<span className={`text-sm ${connected ? "text-good-ink" : "text-muted"}`}>
											{connected ? (
												<>
													<span aria-hidden>✓ </span>Connected
												</>
											) : p.publicKey ? (
												"Waiting for its first visit"
											) : (
												"No keys yet"
											)}
										</span>
									</Link>
								</li>
							);
						})}
					</ul>
				)}
			</section>

			<p className="text-xs text-muted">
				Raw page views, events, uptime checks and job runs are deleted after 90 days. Daily totals are kept. No cookies, and no IP addresses, names or emails are stored.
			</p>
		</div>
	);
}
