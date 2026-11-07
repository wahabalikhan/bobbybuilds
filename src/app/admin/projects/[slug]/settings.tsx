import type { ReactNode } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CopyButton } from "@/components/admin/copy-button";
import { CheckboxField, FieldError, Hidden, SelectField, SettingsForm, TextArea, TextField } from "@/components/admin/form";
import { Switch } from "@/components/admin/switch";
import { TaglineFields } from "@/components/admin/tagline-fields";
import { FunnelRows } from "@/components/admin/funnel-rows";
import { Pill, ProjectLogo } from "@/components/admin/ui";
import { adminIcons } from "@/lib/admin/icons";
import { getIconMeta } from "@/lib/db/icons";
import { requestTime } from "@/lib/admin/clock";
import { FUNNEL_ROWS, OUTCOME_ROWS } from "@/lib/admin/validate";
import { listMetrics, outcomeNumbers, type Metric } from "@/lib/db/dashboard";
import { utcDay } from "@/lib/days";
import { formatTime, formatWhole, timeAgo } from "@/lib/format";
import { parseFunnel } from "@/lib/db/funnel";
import type { Project } from "@/lib/db/projects";
import { site } from "@/lib/site";
import { addMetricAction, deleteMetricAction, deleteProjectAction, eventsAction, funnelAction, keysAction, originsAction, publicPageAction, refreshIconAction, saveDetailsAction } from "../../settings/actions";

/**
 * A project's settings, one scrolling page: About, On the public page, "Advanced: connecting the
 * site" (closed), and the Danger zone at the very bottom.
 */
export async function ProjectSettingsTab({ project }: { project: Project }) {
	// Read here, not passed in: in dev, React can't serialise the D1 binding as a prop.
	const { env } = await getCloudflareContext({ async: true });
	const db = env.DB;
	const [metrics, numbers, iconMeta] = await Promise.all([listMetrics(db, project.id), outcomeNumbers(db, project.id, utcDay(requestTime())), getIconMeta(db, project.id)]);
	return (
		<div className="space-y-12">
			<Section title="About">
				<SettingsForm action={saveDetailsAction}>
					<Hidden name="project_id" value={project.id} />
					<div className="space-y-4">
						<TextField name="name" label="Name" defaultValue={project.name} maxLength={60} required />
						<SelectField
							name="status"
							label="Status"
							defaultValue={project.status}
							options={[
								{ value: "live", label: "Live" },
								{ value: "building", label: "Building" },
								{ value: "paused", label: "Paused" },
								{ value: "idea", label: "Idea" },
								{ value: "retired", label: "Retired" },
							]}
						/>
					</div>
					<TextField type="url" name="site_url" label="Site address" defaultValue={project.siteUrl ?? ""} placeholder="https://" hint="Where the public card links to. It's checked every 5 minutes to see if it's up." />
					<div className="space-y-4">
						<TextField type="date" name="started_on" label="Live since" defaultValue={project.startedOn ?? ""} hint="The day it went live. Its charts start here (or when tracking started, if that's later)." />
						<TextField type="number" name="sort_order" label="Order" defaultValue={String(project.sortOrder)} hint="Position in lists. 1 is first." />
					</div>
				</SettingsForm>
			</Section>

			<Section title="On the public page">
				<PublicPage project={project} metrics={metrics} numbers={numbers} />
			</Section>

			<details id="advanced" open={Boolean(iconMeta?.lastError)} className="group rounded-2xl border border-line bg-card">
				<summary className="flex list-none items-center justify-between gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
					<span>
						<span className="text-[15px] font-medium tracking-tight">Advanced: connecting the site</span>
						<span className="block text-sm text-muted">Tracking code and the technical setup. You&rsquo;ll rarely need this.</span>
					</span>
					<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180">
						<path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</summary>
				<div className="space-y-8 border-t border-line p-4">
					<Advanced project={project} />
					<Sub title="Icon">
						<IconBlock project={project} db={db} />
					</Sub>
				</div>
			</details>

			<DangerZone project={project} metrics={metrics} />
		</div>
	);
}

const KIND = { svg: "its site (its main icon)", "apple-touch-icon": "its site (its app icon)", manifest: "its site (its app icon)", favicon: "its site (its tab icon)" } as const;

/** The project's current icon, where it came from and when it was last checked, with "Refresh icon now". */
async function IconBlock({ project, db }: { project: Project; db: D1Database }) {
	const [meta, iconFor] = await Promise.all([getIconMeta(db, project.id), adminIcons(db)]);
	const src = iconFor(project);
	const now = requestTime();
	return (
		<div className="space-y-4">
			<div className="flex items-start gap-4">
				<ProjectLogo name={project.name} logoPath={src} size={44} />
				<div className="min-w-0 text-sm">
					<p className="text-ink">
						{meta?.hash && meta.kind
							? <>Taken from {KIND[meta.kind]}{meta.sourceUrl && <span className="block truncate text-muted" title={meta.sourceUrl}>{meta.sourceUrl}</span>}</>
							: src
								? "Not found on its site yet, so the saved logo is used."
								: "Not found on its site yet, so its first letter is shown."}
					</p>
					<p className="mt-1 text-muted">
						{meta ? <span title={formatTime(meta.checkedAt)}>Last checked {timeAgo(meta.checkedAt, now)}</span> : "Not checked yet"}
						{meta?.lastError && <span className="block text-critical-ink">{meta.lastError}</span>}
					</p>
				</div>
			</div>
			<SettingsForm action={refreshIconAction} submitLabel="Refresh icon now">
				<Hidden name="project_id" value={project.id} />
				<p className="text-xs text-muted">Checked daily from its site. A copy is kept here, so the card still shows it if the site is down.</p>
			</SettingsForm>
		</div>
	);
}

/** A Settings section: its own bordered card, the heading 16px above its one-column form. */
function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="rounded-2xl border border-line bg-card p-4">
			<h2 className="mb-4 text-[15px] font-medium tracking-tight">{title}</h2>
			{children}
		</section>
	);
}

/**
 * One form, saved together (publicPageAction): Show on my public page; the tagline (its fallback
 * only while it uses {numbers}); the switches for the numbers it can use, next to it; Show
 * visitors; and the extra lines for the chart's hover card.
 */
function PublicPage({ project, metrics, numbers }: { project: Project; metrics: Metric[]; numbers: Awaited<ReturnType<typeof outcomeNumbers>> }) {
	const visitors = metrics.find((m) => m.source === "collector" && m.key === "visitors");
	const products = metrics.filter((m) => m.source === "product");
	return (
		<SettingsForm action={publicPageAction}>
			<Hidden name="project_id" value={project.id} />
			<div className="rounded-2xl border border-line">
				<Switch
					id="show_public"
					name="show_public"
					label="Show on my public page"
					hint={project.showOnFirstVisit ? "Hidden from your public page until its first visit. You can show it any time." : "Its card and its visitors. Turning it off only hides it from the public."}
					checked={project.showPublic}
				/>
			</div>
			<TaglineFields tagline={project.tagline} fallback={project.taglineFallback} />
			{products.length > 0 && (
				<div>
					<p className="text-sm font-medium">Numbers the tagline can use</p>
					<div className="mt-1.5 divide-y divide-line rounded-2xl border border-line">
						{products.map((m) => (
							<Switch key={m.id} id={`public_${m.id}`} name={`public_${m.id}`} label={m.label} hint={`Lets the tagline and extra lines use {${m.key}}. Hidden if it's over a week old.`} checked={m.isPublic} />
						))}
					</div>
				</div>
			)}
			{visitors && (
				<div className="rounded-2xl border border-line">
					<Switch id={`public_${visitors.id}`} name={`public_${visitors.id}`} label="Show visitors" hint="Its chart on the card, and in the public visitor totals." checked={visitors.isPublic} />
				</div>
			)}
			<Outcomes project={project} numbers={numbers} />
		</SettingsForm>
	);
}

/**
 * Up to 3 extra lines for the card chart's hover card, each with a live number in {braces}, under
 * the tagline (saved with On the public page). Closed while there are none.
 */
function Outcomes({ project, numbers }: { project: Project; numbers: Awaited<ReturnType<typeof outcomeNumbers>> }) {
	return (
		<details open={project.outcomes.length > 0} className="group rounded-2xl border border-line">
			<summary className="flex list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
				<span>
					Extra lines in the chart&rsquo;s hover card <span className="font-normal text-muted">(optional)</span>
				</span>
				<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180">
					<path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			</summary>
			<div className="space-y-3 border-t border-line p-4">
				<p className="text-xs text-muted">
					Up to 3, each with a number in &#123;braces&#125;. A line whose number is private or over a week old is left out.
					{numbers.length > 0 ? (
						<>
							{" "}You can use:{" "}
							{numbers.map((n, i) => (
								<span key={n.key}>
									{i > 0 && " · "}
									<code>&#123;{n.key}&#125;</code> ({n.value === null ? "no value yet" : `${formatWhole(n.value)} ${n.period}`}
									{!n.isPublic && ", private"})
								</span>
							))}
						</>
					) : (
						" This project has no numbers yet."
					)}
				</p>
				{Array.from({ length: OUTCOME_ROWS }, (_, i) => (
					<TextField key={i} name={`outcome_${i}`} label={`Line ${i + 1}`} defaultValue={project.outcomes[i] ?? ""} maxLength={80} placeholder={i === 0 && numbers[0] ? `{${numbers[0].key}} …` : ""} />
				))}
			</div>
		</details>
	);
}

function Sub({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="space-y-3">
			<h3 className="text-sm font-medium">{title}</h3>
			{children}
		</div>
	);
}

/** "Advanced: connecting the site": the tracking code, the sites allowed to send visits, the actions it sends, funnel steps and adding a number. */
function Advanced({ project }: { project: Project }) {
	const snippet = project.publicKey ? `<script defer src="${site.url}/t.js" data-key="${project.publicKey}"></script>` : null;
	const steps = parseFunnel(project.funnel);
	return (
		<>
			<Sub title="Tracking code">
				{snippet ? (
					<>
						<pre className="overflow-x-auto rounded-xl bg-surface p-3 text-xs">{snippet}</pre>
						<CopyButton text={snippet} label="Copy code" />
						<p className="text-sm text-ink-2">
							Paste it into the <code>&lt;head&gt;</code> of every page. To count an action, call <code>bobby.track(&quot;name&quot;)</code>.
						</p>
					</>
				) : (
					<p className="text-sm text-muted">No tracking code yet. Make it under Secret key below.</p>
				)}
			</Sub>

			{!project.secretKeyHint && (
				<Sub title="Secret key">
					<p className="text-sm text-ink-2">Makes the tracking code if it&rsquo;s missing, and a secret key for the product&rsquo;s server (shown once only).</p>
					<SettingsForm action={keysAction} submitLabel={project.publicKey ? "Make a secret key" : "Make the keys"}>
						<Hidden name="project_id" value={project.id} />
					</SettingsForm>
				</Sub>
			)}

			<Sub title="Sites allowed to send visits">
				<SettingsForm action={originsAction}>
					<Hidden name="project_id" value={project.id} />
					<TextArea name="origins" label="Addresses" rows={3} mono defaultValue={project.allowedOrigins.join("\n")} hint="One address per line, with and without www if both are used." />
				</SettingsForm>
			</Sub>

			<Sub title="Actions the site sends">
				<p className="text-sm text-ink-2">Counted automatically: links out, downloads, missing pages, forms started and forms sent.</p>
				<SettingsForm action={eventsAction}>
					<Hidden name="project_id" value={project.id} />
					<TextArea name="browser_events" label="Other actions" rows={3} mono defaultValue={project.browserEvents.join("\n")} hint="Other actions the site sends. One name per line." />
				</SettingsForm>
			</Sub>

			<Sub title="Funnel steps">
				<p className="text-sm text-ink-2">Up to 8 steps: a page (like /pricing) or an action. Clear a step to remove it. The funnel shows on the Overview once there&rsquo;s a step.</p>
				<SettingsForm action={funnelAction} submitLabel="Save funnel">
					<Hidden name="project_id" value={project.id} />
					<FunnelRows
						saved={steps.length}
						rows={Array.from({ length: FUNNEL_ROWS }, (_, i) => {
							const step = steps[i];
							return (
								<fieldset key={i} className="space-y-3 rounded-xl border border-line p-3">
									<legend className="px-1 text-sm font-medium">Step {i + 1}</legend>
									<TextField name={`step_label_${i}`} label="Label" defaultValue={step?.label ?? ""} maxLength={40} />
									<SelectField
										name={`step_kind_${i}`}
										label="Type"
										defaultValue={step?.event ? "event" : "page"}
										options={[
											{ value: "page", label: "Page" },
											{ value: "event", label: "Action" },
										]}
									/>
									<TextField name={`step_value_${i}`} label="Page or action name" defaultValue={step?.path ?? step?.event ?? ""} placeholder={i === 0 ? "/" : ""} />
									<FieldError name={`step_${i}`} />
								</fieldset>
							);
						})}
					/>
				</SettingsForm>
			</Sub>

			<Sub title="Add a product number">
				<p className="text-sm text-ink-2">{project.name}&rsquo;s server sends this number each day. It&rsquo;s private until you switch it on.</p>
				<SettingsForm action={addMetricAction} submitLabel="Add number">
					<Hidden name="project_id" value={project.id} />
					<Hidden name="source" value="product" />
					<div className="space-y-4">
						<TextField name="label" label="Label" maxLength={60} placeholder="Open jobs" />
						<TextField name="key" label="Code name" maxLength={40} hint="Made from the label if left blank." />
					</div>
				</SettingsForm>
			</Sub>
		</>
	);
}

/**
 * The Danger zone, at the very bottom and visibly separate: replace the secret key, remove a
 * number and delete the project, each with what it does in one plain line and its own check.
 */
function DangerZone({ project, metrics }: { project: Project; metrics: Metric[] }) {
	const products = metrics.filter((m) => m.source === "product");
	return (
		<section aria-labelledby="danger-heading" className="rounded-2xl border border-danger-line bg-card p-4">
			<h2 id="danger-heading" className="mb-4 text-[15px] font-medium tracking-tight text-critical-ink">
				Danger zone
			</h2>
			<div className="space-y-8">

			{project.secretKeyHint && (
				<Sub title="Replace the secret key">
					<p className="text-sm text-ink-2">
						The current one ends in <Pill>…{project.secretKeyHint}</Pill>. It stops working straight away, so {project.name}&rsquo;s server can&rsquo;t send numbers until you give it the new one (shown once only).
					</p>
					<SettingsForm action={keysAction} submitLabel="Replace secret key" danger>
						<Hidden name="project_id" value={project.id} />
						<CheckboxField name="confirm_rotate" label="I understand the old secret key stops working straight away." />
						<FieldError name="confirm_rotate" />
					</SettingsForm>
				</Sub>
			)}

			{products.length > 0 && (
				<Sub title="Remove a number">
					<p className="text-sm text-ink-2">Its history is deleted. If the product still sends this number, its other numbers will stop updating too.</p>
					<SettingsForm action={deleteMetricAction} submitLabel="Remove number" danger>
						<Hidden name="project_id" value={project.id} />
						<SelectField name="metric_id" label="Number" options={products.map((m) => ({ value: String(m.id), label: `${m.label} (${m.key})` }))} />
						<CheckboxField name="confirm" label="Remove it and its history." />
					</SettingsForm>
				</Sub>
			)}

			<Sub title="Delete this project">
				<p className="text-sm text-ink-2">Deletes the project and everything recorded for it. Journey entries stay. This can&rsquo;t be undone.</p>
				<SettingsForm action={deleteProjectAction} submitLabel="Delete project for good" danger>
					<Hidden name="project_id" value={project.id} />
					<TextField name="confirm_slug" label={`Type ${project.slug} to confirm`} />
				</SettingsForm>
			</Sub>
			</div>
		</section>
	);
}
