import type { ReactNode } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CopyButton } from "@/components/admin/copy-button";
import { CheckboxField, FieldError, Hidden, SelectField, SettingsForm, TextArea, TextField } from "@/components/admin/form";
import { Switch } from "@/components/admin/switch";
import { Pill } from "@/components/admin/ui";
import { BUILT_IN_EVENTS } from "@/lib/collector/validate";
import { requestTime } from "@/lib/admin/clock";
import { FUNNEL_ROWS, OUTCOME_ROWS } from "@/lib/admin/validate";
import { listMetrics, outcomeNumbers, type Metric } from "@/lib/db/dashboard";
import { utcDay } from "@/lib/days";
import { formatWhole } from "@/lib/format";
import { SCREENSHOTS } from "@/lib/logos.generated";
import { parseFunnel } from "@/lib/db/funnel";
import type { Project } from "@/lib/db/projects";
import { site } from "@/lib/site";
import { addMetricAction, deleteMetricAction, deleteProjectAction, eventsAction, funnelAction, keysAction, originsAction, publicCardAction, saveDetailsAction, visibilityAction } from "../../settings/actions";

/**
 * A project's settings, one scrolling page: About this project, On your public page, Connection
 * (closed by default), and Delete this project at the very bottom.
 */
export async function ProjectSettingsTab({ project }: { project: Project }) {
	// Read here, not passed in: in dev, React can't serialise the D1 binding as a prop.
	const { env } = await getCloudflareContext({ async: true });
	const db = env.DB;
	const [metrics, numbers] = await Promise.all([listMetrics(db, project.id), outcomeNumbers(db, project.id, utcDay(requestTime()))]);
	return (
		<div className="max-w-3xl space-y-10">
			<Section title="About this project">
				<SettingsForm action={saveDetailsAction}>
					<Hidden name="project_id" value={project.id} />
					<div className="grid gap-4 sm:grid-cols-2">
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
					<TextField
						name="tagline"
						label="Tagline"
						defaultValue={project.tagline}
						maxLength={120}
						hint="Shown on your public page, up to two lines. Public product numbers can go in it, like {open_jobs}, filled in with the latest value."
					/>
					<TextField
						name="tagline_fallback"
						label="Fallback tagline"
						defaultValue={project.taglineFallback}
						maxLength={120}
						hint="Shown instead when a number in the tagline is over a week old or isn't public. Only needed with numbers in the tagline."
					/>
					<TextField type="url" name="site_url" label="Site address" defaultValue={project.siteUrl ?? ""} placeholder="https://" hint="Where the public card links to. It's also checked every 5 minutes for uptime." />
					<div className="sm:w-40">
						<TextField type="number" name="sort_order" label="Order" defaultValue={String(project.sortOrder)} hint="1 comes first, here and on your public page." />
					</div>
				</SettingsForm>
			</Section>

			<Section title="On your public page">
				<div className="space-y-8">
					<PublicCard project={project} numbers={numbers} />
					<PublicSwitches project={project} metrics={metrics} />
				</div>
			</Section>

			<details className="group rounded-2xl border border-line bg-card">
				<summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
					<span>
						<span className="font-medium">Connection</span>
						<span className="block text-sm text-muted">The snippet, allowed websites, events, funnel, secret key and product numbers.</span>
					</span>
					<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180">
						<path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</summary>
				<div className="space-y-8 border-t border-line p-5">
					<Connection project={project} metrics={metrics} />
				</div>
			</details>

			<section aria-labelledby="delete-heading" className="mt-16 border-t-2 border-[color-mix(in_srgb,var(--critical)_35%,transparent)] pt-8">
				<h2 id="delete-heading" className="text-[15px] font-medium tracking-tight text-critical">
					Delete this project
				</h2>
				<p className="mb-4 mt-1 text-sm text-ink-2">
					Removes the project, its keys, settings, page views, events, roll-ups, numbers and uptime. Journey entries are kept. It can&rsquo;t be undone.
				</p>
				<SettingsForm action={deleteProjectAction} submitLabel="Delete project for good" danger>
					<Hidden name="project_id" value={project.id} />
					<TextField name="confirm_slug" label={`Type ${project.slug} to confirm`} />
				</SettingsForm>
			</section>
		</div>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section>
			<h2 className="mb-4 border-b border-line pb-2 text-[15px] font-medium tracking-tight">{title}</h2>
			{children}
		</section>
	);
}

/**
 * The project's card on the public page: emoji, hero screenshot (from public/screenshots/, with
 * alt text), case study link, and up to 3 outcomes with live numbers.
 */
function PublicCard({ project, numbers }: { project: Project; numbers: Awaited<ReturnType<typeof outcomeNumbers>> }) {
	// A saved screenshot whose file has gone stays in the list, so saving doesn't drop it.
	const files = project.screenshotPath && !SCREENSHOTS.includes(project.screenshotPath) ? [project.screenshotPath, ...SCREENSHOTS] : SCREENSHOTS;
	return (
		<SettingsForm action={publicCardAction} submitLabel="Save card">
			<Hidden name="project_id" value={project.id} />
			<div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
				<TextField name="emoji" label="Emoji" defaultValue={project.emoji} maxLength={16} placeholder="💼" hint="Before the name." />
				<TextField type="url" name="case_study_url" label="Case study link" defaultValue={project.caseStudyUrl ?? ""} placeholder="https://wahabalikhan.com/…" hint={'Shows "Read the case study". Leave blank if there isn\u2019t one.'} />
			</div>
			<SelectField
				name="screenshot_path"
				label="Screenshot"
				defaultValue={project.screenshotPath ?? ""}
				hint={files.length ? "The big image on the card. Add files to public/screenshots/ (about 2,000px wide, 16:10)." : "No files yet. Add one to public/screenshots/ (about 2,000px wide, 16:10, WebP is smallest), then restart the dev server."}
				options={[{ value: "", label: "No screenshot" }, ...files.map((f) => ({ value: f, label: f.replace("/screenshots/", "") }))]}
			/>
			<TextArea name="screenshot_alt" label="What the screenshot shows" rows={2} maxLength={300} defaultValue={project.screenshotAlt} hint="Alt text for people who can't see it. Needed with a screenshot." />
			<div className="space-y-3">
				<div>
					<p className="text-sm font-medium">Outcomes</p>
					<p className="mt-0.5 text-xs text-muted">
						Up to 3, each with a live number in &#123;braces&#125;. One whose number is private or over a week old is left out.
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
				</div>
				{Array.from({ length: OUTCOME_ROWS }, (_, i) => (
					<TextField key={i} name={`outcome_${i}`} label={`Outcome ${i + 1}`} defaultValue={project.outcomes[i] ?? ""} maxLength={80} placeholder={i === 0 && numbers[0] ? `{${numbers[0].key}} …` : ""} />
				))}
			</div>
		</SettingsForm>
	);
}

/**
 * "Show on my public page" (the project at all), then "Show visitors" (the public chart and
 * sparkline) and a switch for each product number (the card's line).
 */
function PublicSwitches({ project, metrics }: { project: Project; metrics: Metric[] }) {
	const visitors = metrics.find((m) => m.source === "collector" && m.key === "visitors");
	const products = metrics.filter((m) => m.source === "product");
	return (
		<SettingsForm action={visibilityAction} submitLabel="Save">
			<Hidden name="project_id" value={project.id} />
			<div className="divide-y divide-line rounded-2xl border border-line">
				<Switch
					id="show_public"
					name="show_public"
					label="Show on my public page"
					hint="Its card, and its visitors in the public chart and totals. When it's off, it's still everywhere here in the admin."
					checked={project.showPublic}
				/>
				{visitors && <Switch id={`public_${visitors.id}`} name={`public_${visitors.id}`} label="Show visitors" hint="In the public visitors chart and on the card's sparkline." checked={visitors.isPublic} />}
				{products.map((m) => (
					<Switch key={m.id} id={`public_${m.id}`} name={`public_${m.id}`} label={m.label} hint={`On the card as "1,240 ${m.label.toLowerCase()}", from the latest daily value. Hidden if it's over a week old.`} checked={m.isPublic} />
				))}
			</div>
		</SettingsForm>
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

function Connection({ project, metrics }: { project: Project; metrics: Metric[] }) {
	const snippet = project.publicKey ? `<script defer src="${site.url}/t.js" data-key="${project.publicKey}"></script>` : null;
	const steps = parseFunnel(project.funnel);
	const products = metrics.filter((m) => m.source === "product");
	return (
		<>
			<Sub title="Snippet">
				{snippet ? (
					<>
						<pre className="overflow-x-auto rounded-xl bg-surface p-3 text-xs">{snippet}</pre>
						<CopyButton text={snippet} label="Copy snippet" />
						<p className="text-sm text-ink-2">
							Paste it before <code>&lt;/head&gt;</code> on every page. Send custom events with <code>bobby.track(&quot;event_name&quot;, &#123; … &#125;)</code>.
						</p>
					</>
				) : (
					<p className="text-sm text-muted">No keys yet. Create them under Secret key below.</p>
				)}
			</Sub>

			<Sub title="Allowed websites">
				<SettingsForm action={originsAction}>
					<Hidden name="project_id" value={project.id} />
					<TextArea name="origins" label="Only pages on these addresses can send visits" rows={3} mono defaultValue={project.allowedOrigins.join("\n")} hint="One per line, like https://example.com and https://www.example.com." />
				</SettingsForm>
			</Sub>

			<Sub title="Custom events">
				<div className="flex flex-wrap items-center gap-1.5 text-sm text-ink-2">
					<span className="mr-1">Always allowed:</span>
					{Object.keys(BUILT_IN_EVENTS).map((name) => (
						<Pill key={name}>{name}</Pill>
					))}
				</div>
				<SettingsForm action={eventsAction}>
					<Hidden name="project_id" value={project.id} />
					<TextArea name="browser_events" label="Your events" rows={3} mono defaultValue={project.browserEvents.join("\n")} hint="Names the site can send with bobby.track(). One per line." />
				</SettingsForm>
			</Sub>

			<Sub title="Funnel steps">
				<p className="text-sm text-ink-2">Up to 8 steps, in order: a page (a path) or an event. Leave rows blank to remove them. The funnel shows on the Overview once there&rsquo;s a step.</p>
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
			</Sub>

			<Sub title="Secret key">
				<p className="text-sm text-ink-2">
					{project.secretKeyHint ? (
						<>
							For the product&rsquo;s server (events and product numbers). The current one ends in <Pill>…{project.secretKeyHint}</Pill>. Only its hash is stored, so a new one is shown once.
						</>
					) : (
						"Makes the keys: the public one for the snippet, and a secret one for your server, shown once."
					)}
				</p>
				<SettingsForm action={keysAction} submitLabel={project.secretKeyHint ? "Replace secret key" : "Create keys"} danger={Boolean(project.secretKeyHint)}>
					<Hidden name="project_id" value={project.id} />
					{project.secretKeyHint && (
						<>
							<CheckboxField name="confirm_rotate" label="I understand the old secret key stops working straight away." />
							<FieldError name="confirm_rotate" />
						</>
					)}
				</SettingsForm>
			</Sub>

			<Sub title="Add a product number">
				<p className="text-sm text-ink-2">{project.name}&rsquo;s server sends it daily to /v1/metrics with the secret key, using this key. It then gets a switch under On your public page.</p>
				<SettingsForm action={addMetricAction} submitLabel="Add number">
					<Hidden name="project_id" value={project.id} />
					<Hidden name="source" value="product" />
					<div className="grid gap-4 sm:grid-cols-2">
						<TextField name="label" label="Label" maxLength={60} placeholder="Open jobs" />
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
			</Sub>
		</>
	);
}
