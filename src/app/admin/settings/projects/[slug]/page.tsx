import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/admin/copy-button";
import { CheckboxField, FieldError, Hidden, SelectField, SettingsForm, TextArea, TextField } from "@/components/admin/form";
import { AdminNotFoundMessage } from "@/components/admin/not-found-message";
import { ProjectFields } from "@/components/admin/project-fields";
import { Breadcrumb, Pill, ProjectLogo, StatusPill } from "@/components/admin/ui";
import { BUILT_IN_EVENTS } from "@/lib/collector/validate";
import { FUNNEL_ROWS } from "@/lib/admin/validate";
import { listMetrics, type Metric } from "@/lib/db/dashboard";
import { parseFunnel } from "@/lib/db/funnel";
import { getProjectBySlug, type Project } from "@/lib/db/projects";
import { logoFor } from "@/lib/project-logo";
import { adminHref, site } from "@/lib/site";
import { addMetricAction, deleteMetricAction, deleteProjectAction, eventsAction, funnelAction, keysAction, originsAction, saveDetailsAction, visibilityAction } from "../../actions";

/** One page per project, in plain sections: Basics, Connection, Tracking, What's public, Danger zone. */
export default async function ProjectSettings({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const { env } = await getCloudflareContext({ async: true });
	const project = await getProjectBySlug(env.DB, slug);
	if (!project) return <AdminNotFoundMessage what={`There’s no project called “${slug.slice(0, 60)}”.`} />;
	const metrics = await listMetrics(env.DB, project.id);

	return (
		<div className="max-w-3xl space-y-10">
			<div className="space-y-3">
				<Breadcrumb items={[{ label: "Settings", href: adminHref("/settings") }, { label: project.name }]} />
				<div className="flex flex-wrap items-center gap-3">
					<ProjectLogo name={project.name} logoPath={logoFor(project)} size={36} />
					<h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
					<StatusPill status={project.status} />
					<Link href={adminHref(`/projects/${project.slug}`)} className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
						Open dashboard
					</Link>
				</div>
			</div>

			<Section id="basics" title="Basics">
				<SettingsForm action={saveDetailsAction}>
					<Hidden name="project_id" value={project.id} />
					<ProjectFields project={project} />
				</SettingsForm>
			</Section>

			<Section id="connection" title="Connection" note="How the site sends its visits and events.">
				<Connection project={project} />
			</Section>

			<Section id="tracking" title="Tracking" note="Custom browser events and the funnel.">
				<Tracking project={project} />
			</Section>

			<Section id="public" title="What's public" note="What the public page at bobbybuilds.app shows for this project.">
				<WhatsPublic project={project} metrics={metrics} />
				<ProductNumbers project={project} metrics={metrics} />
			</Section>

			<Section id="danger" title="Danger zone">
				<p className="mb-4 text-sm text-ink-2">
					Deleting removes the project, its keys, settings, page views, events, roll-ups, numbers and uptime. Journey entries are kept. It can&rsquo;t be undone.
				</p>
				<SettingsForm action={deleteProjectAction} submitLabel="Delete project for good" danger>
					<Hidden name="project_id" value={project.id} />
					<TextField name="confirm_slug" label={`Type ${project.slug} to confirm`} />
				</SettingsForm>
			</Section>
		</div>
	);
}

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
	return (
		<section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-6">
			<div className="mb-4 border-b border-line pb-2">
				<h2 id={`${id}-heading`} className="text-[15px] font-medium tracking-tight">
					{title}
				</h2>
				{note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
			</div>
			{children}
		</section>
	);
}

function Connection({ project }: { project: Project }) {
	const snippet = project.publicKey ? `<script defer src="${site.url}/t.js" data-key="${project.publicKey}"></script>` : null;
	return (
		<div className="space-y-8">
			<div className="space-y-3">
				<h3 className="text-sm font-medium">Script snippet</h3>
				{snippet ? (
					<>
						<pre className="overflow-x-auto rounded-xl bg-surface p-3 text-xs">{snippet}</pre>
						<CopyButton text={snippet} label="Copy snippet" />
						<p className="text-sm text-ink-2">
							Add it before <code>&lt;/head&gt;</code>. Send custom events with <code>bobby.track(&quot;event_name&quot;, &#123; … &#125;)</code>.
						</p>
						<p className="text-sm text-ink-2">
							Public key: <code className="rounded bg-pill px-1.5 py-0.5">{project.publicKey}</code> <span className="text-muted">(not a secret: it only works from the allowed websites)</span>
						</p>
					</>
				) : (
					<p className="text-sm text-muted">No keys yet. Create them below.</p>
				)}
			</div>
			<div className="space-y-3">
				<h3 className="text-sm font-medium">{project.secretKeyHint ? "Replace secret key" : "Create keys"}</h3>
				<p className="text-sm text-ink-2">
					{project.secretKeyHint ? (
						<>
							The secret key (for the product&rsquo;s server: events and product numbers) ends in <Pill>…{project.secretKeyHint}</Pill>. Only its hash is stored, so it can&rsquo;t be shown again. A new one is shown once.
						</>
					) : (
						"Makes a public key (for the snippet) and a secret key (for your server). The secret key is shown once."
					)}
				</p>
				<SettingsForm action={keysAction} submitLabel={project.secretKeyHint ? "Make a new secret key" : "Create keys"} danger={Boolean(project.secretKeyHint)}>
					<Hidden name="project_id" value={project.id} />
					{project.secretKeyHint && (
						<>
							<CheckboxField name="confirm_rotate" label="I understand the old secret key stops working straight away." />
							<FieldError name="confirm_rotate" />
						</>
					)}
				</SettingsForm>
			</div>
			<div className="space-y-3">
				<h3 className="text-sm font-medium">Allowed websites</h3>
				<SettingsForm action={originsAction}>
					<Hidden name="project_id" value={project.id} />
					<TextArea
						name="origins"
						label="Only pages on these exact addresses can send visits with this public key"
						rows={4}
						mono
						defaultValue={project.allowedOrigins.join("\n")}
						hint="One per line: the scheme, host and port only, like https://example.com and https://www.example.com."
					/>
				</SettingsForm>
			</div>
		</div>
	);
}

function Tracking({ project }: { project: Project }) {
	const steps = parseFunnel(project.funnel);
	return (
		<div className="space-y-8">
			<div className="space-y-3">
				<h3 className="text-sm font-medium">Custom browser events</h3>
				<div className="flex flex-wrap items-center gap-1.5 text-sm text-ink-2">
					<span className="mr-1">Always allowed:</span>
					{Object.keys(BUILT_IN_EVENTS).map((name) => (
						<Pill key={name}>{name}</Pill>
					))}
				</div>
				<SettingsForm action={eventsAction}>
					<Hidden name="project_id" value={project.id} />
					<TextArea name="browser_events" label="Your events" rows={4} mono defaultValue={project.browserEvents.join("\n")} hint="Names the site can send with bobby.track(). One per line: lower-case letters, numbers, _ . or -. Up to 30." />
				</SettingsForm>
			</div>
			<div className="space-y-3">
				<h3 className="text-sm font-medium">Funnel steps</h3>
				<p className="text-sm text-ink-2">Up to 8 steps, in order. Each is a page (a path) or an event. Leave rows blank to remove them. The Funnel tab appears once there&rsquo;s a step.</p>
				<SettingsForm action={funnelAction} submitLabel="Save funnel">
					<Hidden name="project_id" value={project.id} />
					<div className="space-y-3">
						{Array.from({ length: FUNNEL_ROWS }, (_, i) => {
							const step = steps[i];
							return (
								<div key={i} className="grid gap-3 sm:grid-cols-[1fr_8rem_1fr]">
									<TextField name={`step_label_${i}`} label={`Step ${i + 1} label`} defaultValue={step?.label ?? ""} maxLength={40} />
									<SelectField
										name={`step_kind_${i}`}
										label="Type"
										defaultValue={step?.event ? "event" : "page"}
										options={[
											{ value: "page", label: "Page" },
											{ value: "event", label: "Event" },
										]}
									/>
									<TextField name={`step_value_${i}`} label="Path or event name" defaultValue={step?.path ?? step?.event ?? ""} placeholder={i === 0 ? "/" : ""} />
									<div className="sm:col-span-3">
										<FieldError name={`step_${i}`} />
									</div>
								</div>
							);
						})}
					</div>
				</SettingsForm>
			</div>
		</div>
	);
}

/** Visitors (the public chart and sparklines) and each product number (the line on the public card). */
function WhatsPublic({ project, metrics }: { project: Project; metrics: Metric[] }) {
	const visitors = metrics.find((m) => m.source === "collector" && m.key === "visitors");
	const products = metrics.filter((m) => m.source === "product");
	const rows: { metric: Metric; label: string; detail: string }[] = [
		...(visitors ? [{ metric: visitors, label: "Visitors", detail: "In the public visitors chart and on the card's sparkline" }] : []),
		...products.map((m) => ({ metric: m, label: m.label, detail: `Sent by ${project.name} (${m.key}). On the card as "1,240 ${m.label.toLowerCase()}", from the latest daily value` })),
	];
	if (rows.length === 0) return <p className="text-sm text-muted">Nothing to show yet: there are no visitor numbers or product numbers for this project.</p>;
	return (
		<SettingsForm action={visibilityAction} submitLabel="Save">
			<Hidden name="project_id" value={project.id} />
			<ul className="divide-y divide-line rounded-2xl border border-line">
				{rows.map(({ metric, label, detail }) => (
					<li key={metric.id} className="flex items-start gap-3 px-4 py-3">
						<input type="checkbox" id={`public_${metric.id}`} name={`public_${metric.id}`} defaultChecked={metric.isPublic} className="mt-1 h-4 w-4 accent-[var(--ink)]" />
						<label htmlFor={`public_${metric.id}`} className="text-sm">
							<span className="font-medium">{label}</span> <span className="text-muted">public</span>
							<span className="block text-muted">{detail}</span>
						</label>
					</li>
				))}
			</ul>
			{products.length > 0 && <p className="text-sm text-muted">Product numbers older than a week aren&rsquo;t shown, so a stalled sender never shows stale figures.</p>}
		</SettingsForm>
	);
}

/** Product numbers must be set up here before the product's server can send them to /v1/metrics. */
function ProductNumbers({ project, metrics }: { project: Project; metrics: Metric[] }) {
	const products = metrics.filter((m) => m.source === "product");
	return (
		<div className="mt-8 space-y-3">
			<h3 className="text-sm font-medium">Add a product number</h3>
			<p className="text-sm text-ink-2">{project.name}&rsquo;s server sends it daily to /v1/metrics with the secret key, using this key.</p>
			<SettingsForm action={addMetricAction} submitLabel="Add number">
				<Hidden name="project_id" value={project.id} />
				<Hidden name="source" value="product" />
				<div className="grid gap-4 sm:grid-cols-2">
					<TextField name="label" label="Label" maxLength={60} placeholder="Open jobs" hint="Shown on the card in lower case." />
					<TextField name="key" label="Key" maxLength={40} hint="Leave blank to make one from the label." />
				</div>
			</SettingsForm>
			{products.length > 0 && (
				<details className="rounded-2xl border border-line p-4">
					<summary className="cursor-pointer text-sm font-medium">Remove a product number</summary>
					<div className="mt-4">
						<SettingsForm action={deleteMetricAction} submitLabel="Remove number" danger>
							<Hidden name="project_id" value={project.id} />
							<SelectField name="metric_id" label="Number" options={products.map((m) => ({ value: String(m.id), label: `${m.label} (${m.key})` }))} />
							<CheckboxField name="confirm" label="Remove it and all of its history." />
						</SettingsForm>
					</div>
				</details>
			)}
		</div>
	);
}
