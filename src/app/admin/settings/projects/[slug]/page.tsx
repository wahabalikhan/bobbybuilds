import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CopyButton } from "@/components/admin/copy-button";
import { CheckboxField, FieldError, Hidden, SelectField, SettingsForm, TextArea, TextField } from "@/components/admin/form";
import { AdminNotFoundMessage } from "@/components/admin/not-found-message";
import { ProjectFields } from "@/components/admin/project-fields";
import { Card, Pill, ProjectLogo, StatusPill, Tabs } from "@/components/admin/ui";
import { BUILT_IN_EVENTS } from "@/lib/collector/validate";
import { FUNNEL_ROWS } from "@/lib/admin/validate";
import { listMetrics } from "@/lib/db/dashboard";
import { parseFunnel } from "@/lib/db/funnel";
import { getProjectBySlug, type Project } from "@/lib/db/projects";
import { listMilestones } from "@/lib/db/settings";
import { formatDay } from "@/lib/format";
import { adminHref, site } from "@/lib/site";
import {
	addMetricAction,
	deleteMetricAction,
	deleteProjectAction,
	eventsAction,
	funnelAction,
	keysAction,
	milestoneAction,
	originsAction,
	saveDetailsAction,
	visibilityAction,
} from "../../actions";

const SECTIONS = [
	{ key: "details", label: "Details" },
	{ key: "keys", label: "Keys" },
	{ key: "origins", label: "Origins" },
	{ key: "events", label: "Events and funnel" },
	{ key: "numbers", label: "Public numbers" },
	{ key: "milestones", label: "Milestones" },
	{ key: "delete", label: "Delete" },
] as const;

type Section = (typeof SECTIONS)[number]["key"];

export default async function ProjectSettings({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<Record<string, string | undefined>>;
}) {
	const { slug } = await params;
	const query = await searchParams;
	const { env } = await getCloudflareContext({ async: true });
	const project = await getProjectBySlug(env.DB, slug);
	if (!project) return <AdminNotFoundMessage what={`There’s no project called “${slug.slice(0, 60)}”.`} />;
	const section: Section = SECTIONS.some((s) => s.key === query.section) ? (query.section as Section) : "details";
	const base = adminHref(`/settings/projects/${project.slug}`);

	return (
		<div className="space-y-6">
			<div>
				<Link href={adminHref("/settings")} className="text-sm text-muted hover:text-ink">
					← Settings
				</Link>
				<div className="mt-2 flex flex-wrap items-center gap-3">
					<ProjectLogo name={project.name} logoPath={project.logoPath} size={36} />
					<h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
					<StatusPill status={project.status} />
					<Link href={adminHref(`/projects/${project.slug}`)} className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
						View dashboard
					</Link>
				</div>
			</div>
			<div className="border-b border-line pb-4">
				<Tabs tabs={[...SECTIONS]} current={section} hrefFor={(key) => `${base}?section=${key}`} />
			</div>
			{section === "details" && <Details project={project} />}
			{section === "keys" && <Keys project={project} created={query.created === "1"} />}
			{section === "origins" && <Origins project={project} />}
			{section === "events" && <Events project={project} />}
			{section === "numbers" && <Numbers db={env.DB} project={project} />}
			{section === "milestones" && <Milestones db={env.DB} project={project} />}
			{section === "delete" && <Delete project={project} />}
		</div>
	);
}

function Details({ project }: { project: Project }) {
	return (
		<Card className="max-w-3xl">
			<SettingsForm action={saveDetailsAction}>
				<Hidden name="project_id" value={project.id} />
				<ProjectFields project={project} />
			</SettingsForm>
		</Card>
	);
}

function Keys({ project, created }: { project: Project; created: boolean }) {
	const snippet = project.publicKey ? `<script defer src="${site.url}/t.js" data-key="${project.publicKey}"></script>` : null;
	return (
		<div className="max-w-3xl space-y-6">
			{created && <p role="status" className="text-sm text-good-ink">✓ Project created. Next, make its keys and add its origins.</p>}
			<Card title="Public key and snippet" note="The public key isn't a secret: it goes in the page, and only works from this project's origins.">
				{snippet ? (
					<div className="space-y-3">
						<p className="text-sm">
							Public key: <code className="rounded bg-pill px-1.5 py-0.5">{project.publicKey}</code>
						</p>
						<pre className="overflow-x-auto rounded-xl bg-surface p-3 text-xs">{snippet}</pre>
						<CopyButton text={snippet} label="Copy snippet" />
						<p className="text-sm text-ink-2">
							Add it before <code>&lt;/head&gt;</code>. Send custom events with <code>bobby.track(&quot;event_name&quot;, &#123; … &#125;)</code>.
						</p>
					</div>
				) : (
					<p className="text-sm text-muted">No keys yet. Create them below.</p>
				)}
			</Card>
			<Card
				title={project.secretKeyHint ? "Secret key" : "Create keys"}
				note={
					project.secretKeyHint ? (
						<>
							The current secret key ends in <Pill>…{project.secretKeyHint}</Pill>. It&rsquo;s used by your server for events and product numbers. Only its hash is stored, so it can&rsquo;t be shown again.
						</>
					) : (
						"Makes a public key (for the snippet) and a secret key (for your server). The secret key is shown once."
					)
				}
			>
				<SettingsForm action={keysAction} submitLabel={project.secretKeyHint ? "Make a new secret key" : "Create keys"} danger={Boolean(project.secretKeyHint)}>
					<Hidden name="project_id" value={project.id} />
					{project.secretKeyHint && (
						<>
							<CheckboxField name="confirm_rotate" label="I understand the old secret key stops working straight away." />
							<FieldError name="confirm_rotate" />
						</>
					)}
				</SettingsForm>
			</Card>
		</div>
	);
}

function Origins({ project }: { project: Project }) {
	return (
		<Card className="max-w-3xl" title="Allowed origins" note="Only pages on these exact origins can send page views and browser events with this project's public key.">
			<SettingsForm action={originsAction}>
				<Hidden name="project_id" value={project.id} />
				<TextArea
					name="origins"
					label="Origins"
					rows={5}
					mono
					defaultValue={project.allowedOrigins.join("\n")}
					hint="One per line: the scheme, host and port only, like https://example.com and https://www.example.com. Use https, except for http://localhost."
				/>
			</SettingsForm>
		</Card>
	);
}

function Events({ project }: { project: Project }) {
	const steps = parseFunnel(project.funnel);
	return (
		<div className="max-w-3xl space-y-6">
			<Card title="Browser events" note="Event names the site can send with bobby.track(). Anything else from a browser is refused.">
				<div className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-ink-2">
					<span className="mr-1">Always on:</span>
					{Object.keys(BUILT_IN_EVENTS).map((name) => (
						<Pill key={name}>{name}</Pill>
					))}
				</div>
				<SettingsForm action={eventsAction}>
					<Hidden name="project_id" value={project.id} />
					<TextArea name="browser_events" label="Your events" rows={4} mono defaultValue={project.browserEvents.join("\n")} hint="One per line (or separated by commas): lower-case letters, numbers, _ . or -. Up to 30." />
				</SettingsForm>
			</Card>
			<Card title="Funnel" note="Up to 8 steps, in order. Each is a page (a path) or an event. Leave rows blank to remove them.">
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
			</Card>
		</div>
	);
}

async function Numbers({ db, project }: { db: D1Database; project: Project }) {
	const metrics = await listMetrics(db, project.id);
	const SOURCE: Record<string, string> = { collector: "From page views", event: "From an event", product: "Sent by the product" };
	return (
		<div className="max-w-3xl space-y-6">
			<Card title="Public numbers" note="Choose which numbers the public project page shows, and which one goes in the pill on the project card.">
				{metrics.length === 0 ? (
					<p className="text-sm text-muted">No numbers yet. Add one below.</p>
				) : (
					<SettingsForm action={visibilityAction} submitLabel="Save public numbers">
						<Hidden name="project_id" value={project.id} />
						<table className="w-full text-sm">
							<thead className="text-left text-muted">
								<tr>
									<th className="pb-2 font-medium">Number</th>
									<th className="pb-2 text-center font-medium">Public</th>
									<th className="pb-2 text-center font-medium">On the card</th>
								</tr>
							</thead>
							<tbody>
								{metrics.map((m) => (
									<tr key={m.id} className="border-t border-line">
										<td className="py-2.5">
											<span className="font-medium">{m.label}</span>
											<span className="block text-xs text-muted">
												{SOURCE[m.source]}
												{m.eventName ? ` (${m.eventName})` : ""} · key <code>{m.key}</code>
											</span>
										</td>
										<td className="text-center">
											<input type="checkbox" name={`public_${m.id}`} defaultChecked={m.isPublic} aria-label={`${m.label} is public`} className="h-4 w-4 accent-[var(--ink)]" />
										</td>
										<td className="text-center">
											<input type="radio" name="headline" value={m.id} defaultChecked={m.isHeadline} aria-label={`${m.label} goes on the card`} className="h-4 w-4 accent-[var(--ink)]" />
										</td>
									</tr>
								))}
								<tr className="border-t border-line">
									<td className="py-2.5 text-muted">No number on the card</td>
									<td />
									<td className="text-center">
										<input type="radio" name="headline" value="" defaultChecked={!metrics.some((m) => m.isHeadline)} aria-label="No number on the card" className="h-4 w-4 accent-[var(--ink)]" />
									</td>
								</tr>
							</tbody>
						</table>
					</SettingsForm>
				)}
			</Card>
			<Card title="Add a number" note="A product number is sent by the product's server through /v1/metrics. An event number counts one event each day.">
				<SettingsForm action={addMetricAction} submitLabel="Add number">
					<Hidden name="project_id" value={project.id} />
					<div className="grid gap-4 sm:grid-cols-2">
						<SelectField
							name="source"
							label="Kind"
							defaultValue="product"
							options={[
								{ value: "product", label: "Product number (sent by its server)" },
								{ value: "event", label: "Event count" },
							]}
						/>
						<TextField name="label" label="Label" maxLength={60} placeholder="Jobs listed" />
						<TextField name="key" label="Key" maxLength={40} hint="Leave blank to make one from the label. The product sends this key." />
						<TextField name="unit" label="Unit (optional)" maxLength={20} placeholder="jobs" />
						<TextField name="event_name" label="Event to count (event counts only)" placeholder="case_study_read" />
					</div>
				</SettingsForm>
			</Card>
			{metrics.length > 0 && (
				<details className="rounded-2xl border border-line bg-card p-5">
					<summary className="cursor-pointer font-semibold">Delete a number</summary>
					<div className="mt-4">
						<SettingsForm action={deleteMetricAction} submitLabel="Delete number" danger>
							<Hidden name="project_id" value={project.id} />
							<SelectField name="metric_id" label="Number" options={metrics.map((m) => ({ value: String(m.id), label: `${m.label} (${m.key})` }))} />
							<CheckboxField name="confirm" label="Delete it and all of its history." />
						</SettingsForm>
					</div>
				</details>
			)}
		</div>
	);
}

async function Milestones({ db, project }: { db: D1Database; project: Project }) {
	const milestones = await listMilestones(db, project.id);
	return (
		<div className="max-w-3xl space-y-6">
			<Card title="Add a milestone" note="Shown on the public project page when public.">
				<SettingsForm action={milestoneAction} submitLabel="Add milestone">
					<Hidden name="project_id" value={project.id} />
					<div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
						<TextField type="date" name="day" label="Date" />
						<TextField name="title" label="Title" maxLength={120} placeholder="First paying customer" />
					</div>
					<TextArea name="note" label="Note (optional)" rows={2} maxLength={500} />
					<CheckboxField name="is_public" label="Public" defaultChecked />
				</SettingsForm>
			</Card>
			<section>
				<h2 className="mb-3 font-semibold tracking-tight">Milestones ({milestones.length})</h2>
				{milestones.length === 0 ? (
					<p className="text-sm text-muted">None yet.</p>
				) : (
					<ul className="space-y-3">
						{milestones.map((m) => (
							<li key={m.id}>
								<details className="rounded-2xl border border-line bg-card p-4">
									<summary className="flex cursor-pointer flex-wrap items-center gap-2">
										<span className="text-sm text-muted tabular">{formatDay(m.day, true)}</span>
										<span className="font-medium">{m.title}</span>
										<Pill>{m.isPublic ? "Public" : "Private"}</Pill>
									</summary>
									<div className="mt-4 space-y-4">
										<SettingsForm action={milestoneAction}>
											<Hidden name="project_id" value={project.id} />
											<Hidden name="milestone_id" value={m.id} />
											<div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
												<TextField type="date" name="day" label="Date" defaultValue={m.day} />
												<TextField name="title" label="Title" defaultValue={m.title} maxLength={120} />
											</div>
											<TextArea name="note" label="Note" rows={2} defaultValue={m.note} maxLength={500} />
											<CheckboxField name="is_public" label="Public" defaultChecked={m.isPublic} />
										</SettingsForm>
										<SettingsForm action={milestoneAction} submitLabel="Delete milestone" danger>
											<Hidden name="project_id" value={project.id} />
											<Hidden name="milestone_id" value={m.id} />
											<Hidden name="intent" value="delete" />
										</SettingsForm>
									</div>
								</details>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}

function Delete({ project }: { project: Project }) {
	return (
		<Card className="max-w-3xl" title={`Delete ${project.name}`} note="This deletes the project, its keys, settings, page views, events, roll-ups, numbers, uptime and milestones. Journey entries are kept. It can't be undone.">
			<SettingsForm action={deleteProjectAction} submitLabel="Delete project for good" danger>
				<Hidden name="project_id" value={project.id} />
				<TextField name="confirm_slug" label={`Type ${project.slug} to confirm`} />
			</SettingsForm>
		</Card>
	);
}
