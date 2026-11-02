import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { buttonClass, Pill, ProjectLogo, SectionHeading, StatusPill } from "@/components/admin/ui";
import { listProjects } from "@/lib/db/projects";
import { listJourney } from "@/lib/db/settings";
import { adminHref } from "@/lib/site";

export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
	const { env } = await getCloudflareContext({ async: true });
	const [projects, journey, params] = await Promise.all([listProjects(env.DB), listJourney(env.DB), searchParams]);
	const published = journey.filter((e) => e.isPublished).length;

	return (
		<div className="space-y-12">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
				<Link href={adminHref("/settings/projects/new")} className={buttonClass}>
					New project
				</Link>
			</div>
			{params.deleted && <p role="status" className="text-sm text-good-ink">✓ The project was deleted.</p>}

			<section aria-labelledby="projects-heading">
				<SectionHeading id="projects-heading" aside={projects.length}>Projects</SectionHeading>
				<ul className="divide-y divide-line rounded-2xl border border-line bg-card">
					{projects.map((p) => (
						<li key={p.id}>
							<Link href={adminHref(`/settings/projects/${p.slug}`)} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-surface">
								<span className="flex min-w-0 items-center gap-3">
									<ProjectLogo name={p.name} logoPath={p.logoPath} />
									<span className="min-w-0">
										<span className="flex items-center gap-2 font-medium">
											{p.name} <StatusPill status={p.status} />
										</span>
										<span className="block truncate text-sm text-muted">{p.tagline || "No tagline yet"}</span>
									</span>
								</span>
								<span className="flex items-center gap-2 text-xs">
									<Pill>{p.secretKeyHint ? "Keys ✓" : "No keys"}</Pill>
									<Pill>{p.allowedOrigins.length} origin{p.allowedOrigins.length === 1 ? "" : "s"}</Pill>
								</span>
							</Link>
						</li>
					))}
				</ul>
			</section>

			<div className="grid gap-4 sm:grid-cols-2">
				<Link href={adminHref("/settings/journey")} className="rounded-2xl border border-line bg-card p-5 hover:bg-surface">
					<p className="font-semibold">Journey</p>
					<p className="mt-1 text-sm text-muted">
						{journey.length} entr{journey.length === 1 ? "y" : "ies"}, {published} published. Write and publish build-in-public updates.
					</p>
				</Link>
				<Link href={adminHref("/settings/system")} className="rounded-2xl border border-line bg-card p-5 hover:bg-surface">
					<p className="font-semibold">System</p>
					<p className="mt-1 text-sm text-muted">Job runs, data retention and the tracker&rsquo;s size.</p>
				</Link>
			</div>
		</div>
	);
}
