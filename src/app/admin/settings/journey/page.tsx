import type { Metadata } from "next";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { inputBaseClass } from "@/components/admin/field-styles";
import { ToastOnLoad } from "@/components/admin/toast";
import { Badge, Breadcrumb, buttonClass, chipClass, EmptyState, iconButtonClass, PageHeader, PlusIcon, quietButtonClass, Tooltip } from "@/components/admin/ui";
import { listProjects } from "@/lib/db/projects";
import { listJourney } from "@/lib/db/settings";
import { formatDay } from "@/lib/format";
import { JOURNEY_TYPES, journeyType } from "@/lib/journey-types";
import { adminHref } from "@/lib/site";

export const metadata: Metadata = { title: "Journey" };

const STATUSES = [
	{ value: "", label: "All" },
	{ value: "published", label: "Published" },
	{ value: "draft", label: "Drafts" },
] as const;

/**
 * The journey: short, dated entries for the public page, newest first. A search box (title,
 * text, type and project), type chips with their counts and All / Published / Drafts, all kept in the address
 * (?q=, ?type=, ?status=), so they work without JavaScript and survive a reload. Each row: the
 * type's emoji in a small square, the title, "Type · date · project" and a green Published or
 * grey Draft label (Tech Jobs' list rows).
 */
export default async function JourneyList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
	const { env } = await getCloudflareContext({ async: true });
	const [entries, projects, params] = await Promise.all([listJourney(env.DB), listProjects(env.DB), searchParams]);
	const projectName = new Map(projects.map((p) => [p.id, p.name]));
	const q = (params.q ?? "").trim().slice(0, 100);
	const type = JOURNEY_TYPES.find((t) => t.value === params.type)?.value ?? "";
	const status = STATUSES.find((s) => s.value === params.status)?.value ?? "";
	const words = q.toLowerCase();
	// Search and status first, so each type chip counts what you'd see by choosing it.
	const searched = entries.filter((e) => (!words || `${e.title} ${e.bodyMd} ${journeyType(e.type).label} ${e.projectId ? (projectName.get(e.projectId) ?? "") : ""}`.toLowerCase().includes(words)) && (!status || (status === "published" ? e.isPublished : !e.isPublished)));
	const shown = type ? searched.filter((e) => e.type === type) : searched;
	const href = (changes: Record<string, string>) => {
		const next = new URLSearchParams({ ...(q && { q }), ...(type && { type }), ...(status && { status }), ...changes });
		for (const [key, value] of [...next]) if (!value) next.delete(key);
		const search = next.toString();
		return adminHref(`/settings/journey${search ? `?${search}` : ""}`);
	};
	const add = (
		<Tooltip text="Add an entry">
			<Link href={adminHref("/settings/journey/new")} aria-label="Add an entry" className={iconButtonClass}>
				<PlusIcon />
			</Link>
		</Tooltip>
	);

	return (
		<div className="max-w-3xl space-y-6">
			{params.deleted && <ToastOnLoad tone="info" text="Entry deleted." param="deleted" />}
			<div className="space-y-3">
				<Breadcrumb items={[{ label: "Home", href: adminHref() }, { label: "Journey" }]} />
				<PageHeader title="Journey" subtitle="Short, dated entries for your public page." action={entries.length > 0 ? add : undefined} />
			</div>

			{entries.length === 0 ? (
				<EmptyState
					icon="🚀"
					title="No entries yet"
					action={
						<Link href={adminHref("/settings/journey/new")} className={buttonClass}>
							Add an entry
						</Link>
					}
				>
					Add the first thing you shipped, decided or learned. It shows on your public page once it&rsquo;s published.
				</EmptyState>
			) : (
				<>
					<div className="space-y-3">
						<form method="get" role="search" className="flex gap-2">
							{type && <input type="hidden" name="type" value={type} />}
							{status && <input type="hidden" name="status" value={status} />}
							<label htmlFor="journey-search" className="sr-only">
								Search entries
							</label>
							<input id="journey-search" type="search" name="q" defaultValue={q} placeholder="Search entries" className={`${inputBaseClass} min-w-0 flex-1`} />
							<button className={quietButtonClass}>Search</button>
						</form>
						<nav aria-label="Published or draft" className="flex flex-wrap gap-1.5">
							{STATUSES.map((s) => (
								<Link key={s.value || "all"} href={href({ status: s.value })} aria-current={status === s.value ? "true" : undefined} className={chipClass(status === s.value)}>
									{s.label}
								</Link>
							))}
						</nav>
						<nav aria-label="Entry types" className="flex flex-wrap gap-2">
							<Link href={href({ type: "" })} aria-current={type ? undefined : "true"} className={typeChip(!type)}>
								All <span className="tabular opacity-70">{searched.length}</span>
							</Link>
							{JOURNEY_TYPES.filter((t) => searched.some((e) => e.type === t.value) || t.value === type).map((t) => (
								<Link key={t.value} href={href({ type: t.value })} aria-current={type === t.value ? "true" : undefined} className={typeChip(type === t.value)}>
									<span aria-hidden>{t.emoji}</span>
									{t.label} <span className="tabular opacity-70">{searched.filter((e) => e.type === t.value).length}</span>
								</Link>
							))}
						</nav>
					</div>

					{shown.length === 0 ? (
						<p className="text-sm text-muted">
							No entries match.{" "}
							<Link href={adminHref("/settings/journey")} className="link">
								Clear filters
							</Link>
						</p>
					) : (
						<ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
							{shown.map((e) => {
								const t = journeyType(e.type);
								return (
									<li key={e.id} className="relative flex items-center gap-3 px-4 py-3.5 hover:bg-surface has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-[var(--accent)]">
										<span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-pill text-base">
											{t.emoji}
										</span>
										<div className="min-w-0 flex-1">
											<div className="flex min-w-0 items-center gap-2">
												<Link href={adminHref(`/settings/journey/${e.id}`)} className="truncate font-semibold outline-none after:absolute after:inset-0 hover:underline">
													{e.title}
												</Link>
												<Badge tone={e.isPublished ? "success" : "neutral"}>{e.isPublished ? "Published" : "Draft"}</Badge>
											</div>
											<p className="mt-0.5 truncate text-[13px] text-muted">
												{[t.label, e.publishedAt ? formatDay(new Date(e.publishedAt).toISOString().slice(0, 10), true) : null, e.projectId ? (projectName.get(e.projectId) ?? "Unknown project") : null].filter(Boolean).join(" · ")}
											</p>
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</>
			)}
		</div>
	);
}

/** The type filter chips: pills (labels and filter chips are the only pills), ink when chosen, like the public journey. */
function typeChip(selected: boolean): string {
	return `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${selected ? "border-ink bg-ink text-page" : "border-line text-ink-2 hover:bg-pill hover:text-ink"}`;
}
