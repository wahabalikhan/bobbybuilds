/**
 * The logic behind every settings action, without Next.js: each takes the database, the previous
 * form state and the submitted values, and returns the new state (and sometimes where to go next).
 * src/app/admin/settings/actions.ts wraps these, checking admin access first.
 */
import { listMetrics } from "@/lib/db/dashboard";
import { listProjects, setProjectKeys, type Project } from "@/lib/db/projects";
import { taglineKeys } from "@/lib/public/product-line";
import {
	addMetric,
	createProject,
	deleteJourney,
	deleteMetric,
	deleteProject,
	saveJourney,
	setBrowserEvents,
	setFunnel,
	setMetricVisibility,
	listJourney,
	setOrigins,
	setPublicCard,
	setShowPublic,
	SlugTakenError,
	updateProjectDetails,
} from "@/lib/db/settings";
import { listMonth, replaceMonth } from "@/lib/db/money";
import { refreshProjectIcon } from "@/lib/icons/refresh";
import { saveProfile } from "@/lib/db/profile";
import { addDays } from "@/lib/days";
import { createPublicKey, createSecretKey, hashSecretKey, secretKeyHint } from "@/lib/keys";
import { adminHref, site } from "@/lib/site";
import { failed, ok, type FormState } from "./form-state";
import {
	validateBrowserEvents,
	validateFunnel,
	validateJourney,
	validateNewMetric,
	validateNewProject,
	validateOrigins,
	validateProjectDetails,
	validateMoney,
	validateProfile,
	validatePublicCard,
	isMonth,
	slugify,
	type FormValues,
} from "./validate";

export type ActionResult = { state: FormState; redirectTo?: string };
type Context = { logos: string[]; screenshots?: string[]; now: number };

const settingsHref = (slug: string) => adminHref(`/projects/${slug}?tab=settings`);

async function projectFrom(db: D1Database, values: FormValues): Promise<Project | null> {
	const id = Number(values.project_id);
	if (!Number.isInteger(id) || id <= 0) return null;
	return (await listProjects(db)).find((p) => p.id === id) ?? null;
}

const missing = (prev: FormState): ActionResult => ({ state: { status: "error", version: prev.version + 1, message: "That project no longer exists." } });

// --- Projects ---------------------------------------------------------------------------

export async function saveDetailsCore(db: D1Database, prev: FormState, values: FormValues, ctx: Context): Promise<ActionResult> {
	const project = await projectFrom(db, values);
	if (!project) return missing(prev);
	// Fields "About this project" doesn't show keep their saved values (slug, description, lesson,
	// links, logo, health address, GitHub repo), so saving never wipes or renames them.
	const kept: FormValues = {
		slug: project.slug,
		description_md: project.descriptionMd,
		lesson: project.lesson ?? "",
		links: project.links.map((l) => `${l.label} | ${l.url}`).join("\n"),
		sort_order: String(project.sortOrder),
		logo_path: project.logoPath ?? "",
		health_url: project.healthUrl ?? "",
		github_repo: project.githubRepo ?? "",
	};
	// A saved logo path stays valid even if its file has since gone (logos are automatic now).
	const result = validateProjectDetails({ ...kept, ...values }, project.logoPath ? [...ctx.logos, project.logoPath] : ctx.logos);
	if (!result.ok) return { state: failed(prev, values, result.errors) };
	// Tagline placeholders must be this project's product numbers; private ones never fill in public.
	const products = (await listMetrics(db, project.id)).filter((m) => m.source === "product");
	const keys = taglineKeys(result.value.tagline);
	const unknown = keys.filter((key) => !products.some((m) => m.key === key));
	if (unknown.length) {
		const known = products.map((m) => `{${m.key}}`).join(", ");
		return { state: failed(prev, values, { tagline: `{${unknown[0]}} isn't one of ${project.name}'s product numbers${known ? ` (it has ${known})` : ""}.` }) };
	}
	if (keys.length && !result.value.taglineFallback) {
		return { state: failed(prev, values, { tagline_fallback: "Add a fallback tagline, shown when the numbers can't be filled in." }) };
	}
	const privateKeys = keys.filter((key) => !products.find((m) => m.key === key)!.isPublic);
	try {
		await updateProjectDetails(db, project.id, result.value);
	} catch (error) {
		if (error instanceof SlugTakenError) return { state: failed(prev, values, { slug: "Another project already uses this slug." }) };
		throw error;
	}
	const notes = result.value.slug !== project.slug ? ["The slug changed, so this page's address changed too."] : [];
	if (privateKeys.length) notes.push(`{${privateKeys[0]}} isn't public, so your public page shows the fallback tagline until it is (under On your public page).`);
	return {
		state: ok(prev, "Saved.", notes),
		redirectTo: result.value.slug !== project.slug ? settingsHref(result.value.slug) : undefined,
	};
}

/**
 * New project, step 1: name and site address. Makes the project (slug from the name, made unique
 * with -2, -3… if needed), allows the site's origin, checks it for uptime, and makes its keys.
 * Returns the snippet for step 2.
 */
export async function startProjectCore(db: D1Database, prev: FormState, values: FormValues): Promise<ActionResult> {
	const result = validateNewProject(values);
	if (!result.ok) return { state: failed(prev, values, result.errors) };
	const { name, siteUrl, origin } = result.value;
	// "new" is taken by the New project page's own address.
	const projects = await listProjects(db);
	const taken = new Set(["new", ...projects.map((p) => p.slug)]);
	let slug = result.value.slug;
	for (let n = 2; taken.has(slug); n += 1) slug = `${result.value.slug.slice(0, 36)}-${n}`;

	const id = await createProject(db, {
		name,
		slug,
		tagline: "",
		taglineFallback: "",
		descriptionMd: "",
		status: "building",
		lesson: null,
		logoPath: null,
		siteUrl,
		healthUrl: siteUrl,
		githubRepo: null,
		links: [],
		// Its charts start when its tracking begins until a "Started on" date is set in Settings.
		startedOn: null,
		// New projects go to the end of the list; the order can be changed in Settings.
		sortOrder: Math.min(1000, Math.max(0, ...projects.map((p) => p.sortOrder)) + 1),
	});
	await setOrigins(db, id, [origin]);
	const publicKey = createPublicKey();
	const secretKey = createSecretKey();
	await setProjectKeys(db, slug, { publicKey, secretKeyHash: await hashSecretKey(secretKey), secretKeyHint: secretKeyHint(secretKey) });
	const snippet = `<script defer src="${site.url}/t.js" data-key="${publicKey}"></script>`;
	// The secret key isn't shown (only its hash is kept): one for server events is made later under Connection.
	return { state: ok(prev, `${name} is set up.`, [], { setup: { slug, name, publicKey, snippet } }) };
}

export async function deleteProjectCore(db: D1Database, prev: FormState, values: FormValues): Promise<ActionResult> {
	const project = await projectFrom(db, values);
	if (!project) return missing(prev);
	if ((values.confirm_slug ?? "").trim() !== project.slug) {
		return { state: failed(prev, values, { confirm_slug: `Type ${project.slug} to confirm.` }, "Nothing was deleted.") };
	}
	await deleteProject(db, project.id);
	return { state: ok(prev, `${project.name} was deleted.`), redirectTo: adminHref() };
}

// --- Keys -------------------------------------------------------------------------------

/** Creates both keys, or replaces the secret key (the public key stays, so the snippet doesn't change). */
export async function keysCore(db: D1Database, prev: FormState, values: FormValues): Promise<ActionResult> {
	const project = await projectFrom(db, values);
	if (!project) return missing(prev);
	const rotating = Boolean(project.secretKeyHint);
	if (rotating && values.confirm_rotate !== "on") {
		return { state: failed(prev, values, { confirm_rotate: "Tick the box to confirm. The old secret key stops working straight away." }, "The secret key wasn't changed.") };
	}
	const secretKey = createSecretKey();
	await setProjectKeys(db, project.slug, {
		publicKey: project.publicKey ? undefined : createPublicKey(),
		secretKeyHash: await hashSecretKey(secretKey),
		secretKeyHint: secretKeyHint(secretKey),
	});
	return {
		state: ok(prev, rotating ? "New secret key made. The old one has stopped working." : "Keys created.", [], { secret: secretKey }),
	};
}

// --- Origins, events and funnel ---------------------------------------------------------

export async function originsCore(db: D1Database, prev: FormState, values: FormValues): Promise<ActionResult> {
	const project = await projectFrom(db, values);
	if (!project) return missing(prev);
	const result = validateOrigins(values.origins ?? "", project.siteUrl);
	if (!result.ok) return { state: failed(prev, values, result.errors) };
	await setOrigins(db, project.id, result.value);
	return { state: ok(prev, "Origins saved.", result.notes) };
}

export async function eventsCore(db: D1Database, prev: FormState, values: FormValues): Promise<ActionResult> {
	const project = await projectFrom(db, values);
	if (!project) return missing(prev);
	const result = validateBrowserEvents(values.browser_events ?? "");
	if (!result.ok) return { state: failed(prev, values, result.errors) };
	await setBrowserEvents(db, project.id, result.value);
	return { state: ok(prev, "Browser events saved.", result.notes) };
}

export async function funnelCore(db: D1Database, prev: FormState, values: FormValues): Promise<ActionResult> {
	const project = await projectFrom(db, values);
	if (!project) return missing(prev);
	const result = validateFunnel(values);
	if (!result.ok) return { state: failed(prev, values, result.errors) };
	await setFunnel(db, project.id, result.value);
	return { state: ok(prev, result.value.length ? `Funnel saved with ${result.value.length} step${result.value.length === 1 ? "" : "s"}.` : "Funnel cleared.") };
}

// --- Numbers ----------------------------------------------------------------------------

export async function visibilityCore(db: D1Database, prev: FormState, values: FormValues): Promise<ActionResult> {
	const project = await projectFrom(db, values);
	if (!project) return missing(prev);
	const publicIds = Object.keys(values)
		.filter((key) => /^public_\d+$/.test(key) && values[key] === "on")
		.map((key) => Number(key.slice(7)));
	const headline = values.headline ? Number(values.headline) : null;
	await setMetricVisibility(db, project.id, publicIds, Number.isInteger(headline) ? headline : null);
	await setShowPublic(db, project.id, values.show_public === "on");
	const notes = headline && !publicIds.includes(headline) ? ["The headline number is shown on the public card, so it was made public too."] : [];
	return { state: ok(prev, values.show_public === "on" ? "Saved." : `Saved. ${project.name} isn't on your public page.`, notes) };
}

export async function addMetricCore(db: D1Database, prev: FormState, values: FormValues): Promise<ActionResult> {
	const project = await projectFrom(db, values);
	if (!project) return missing(prev);
	const result = validateNewMetric(values);
	if (!result.ok) return { state: failed(prev, values, result.errors) };
	if ((await addMetric(db, project.id, result.value)) === "exists") return { state: failed(prev, values, { key: "This project already has a number with that key." }) };
	return { state: ok(prev, `${result.value.label} added. It starts private.`) };
}

export async function deleteMetricCore(db: D1Database, prev: FormState, values: FormValues): Promise<ActionResult> {
	const project = await projectFrom(db, values);
	if (!project) return missing(prev);
	if (values.confirm !== "on") return { state: failed(prev, values, {}, "Tick the box to confirm. Its history is deleted too.") };
	await deleteMetric(db, project.id, Number(values.metric_id));
	return { state: ok(prev, "Number deleted.") };
}

// --- Journey ----------------------------------------------------------------------------

export async function journeyCore(db: D1Database, prev: FormState, values: FormValues, ctx: Context): Promise<ActionResult> {
	const id = values.entry_id ? Number(values.entry_id) : null;
	if (values.intent === "delete" && id) {
		await deleteJourney(db, id);
		return { state: ok(prev, "Entry deleted."), redirectTo: adminHref("/settings/journey?deleted=1") };
	}
	const projects = await listProjects(db);
	const result = validateJourney(values, projects.map((p) => p.id), ctx.now);
	if (!result.ok) return { state: failed(prev, values, result.errors) };
	// Entries have no pages of their own, so the slug is only an id: made from the title, made unique.
	let slug: string | undefined;
	if (id === null) {
		const taken = new Set((await listJourney(db)).map((e) => e.slug));
		const base = slugify(result.value.title, 72) || "entry";
		slug = base;
		for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
	}
	try {
		const saved = await saveJourney(db, id, result.value, slug);
		const message = result.value.publish ? "Saved and published." : "Saved as a draft.";
		return { state: ok(prev, message), redirectTo: id === null ? adminHref(`/settings/journey/${saved}?created=1`) : undefined };
	} catch (error) {
		if (error instanceof SlugTakenError) return { state: failed(prev, values, {}, "Another entry was saved at the same moment. Please try again.") };
		throw error;
	}
}

// --- On your public page: the card --------------------------------------------------------

/** The keys a project's outcomes can use: its product numbers, and visitors (30 days). */
export async function outcomeKeys(db: D1Database, projectId: number): Promise<string[]> {
	const metrics = await listMetrics(db, projectId);
	return metrics.filter((m) => m.source === "product" || (m.source === "collector" && m.key === "visitors")).map((m) => m.key);
}

export async function publicCardCore(db: D1Database, prev: FormState, values: FormValues, ctx: Context): Promise<ActionResult> {
	const project = await projectFrom(db, values);
	if (!project) return missing(prev);
	// A saved screenshot stays valid even if its file has since gone.
	const screenshots = [...(ctx.screenshots ?? []), ...(project.screenshotPath ? [project.screenshotPath] : [])];
	const result = validatePublicCard(values, screenshots, await outcomeKeys(db, project.id));
	if (!result.ok) return { state: failed(prev, values, result.errors) };
	await setPublicCard(db, project.id, result.value);
	const metrics = await listMetrics(db, project.id);
	const privateKey = result.value.outcomes.flatMap(taglineKeys).find((key) => !metrics.find((m) => m.key === key)?.isPublic);
	const notes = privateKey ? [`{${privateKey}} isn't public, so outcomes using it are left out until it is (the switches below).`] : [];
	return { state: ok(prev, "Saved.", notes) };
}

// --- Profile ----------------------------------------------------------------------------

export async function profileCore(db: D1Database, prev: FormState, values: FormValues): Promise<ActionResult> {
	const result = validateProfile(values);
	if (!result.ok) return { state: failed(prev, values, result.errors) };
	await saveProfile(db, result.value);
	return { state: ok(prev, "Saved.") };
}

// --- Costs and revenue ------------------------------------------------------------------

export async function moneyCore(db: D1Database, prev: FormState, values: FormValues): Promise<ActionResult> {
	const month = values.month ?? "";
	if (!isMonth(month)) return { state: failed(prev, values, {}, "Choose a month.") };
	const result = validateMoney(values, (await listProjects(db)).map((p) => p.id));
	if (!result.ok) return { state: failed(prev, values, result.errors) };
	await replaceMonth(db, month, result.value);
	return { state: ok(prev, result.value.length ? "Saved." : "Saved. Nothing is listed for this month.") };
}

/** The month before 'YYYY-MM'. */
export function previousMonth(month: string): string {
	return addDays(`${month}-01`, -1).slice(0, 7);
}

/** Copies last month's costs (not revenue) into a month that has no costs yet: most bills repeat. */
export async function copyCostsCore(db: D1Database, prev: FormState, values: FormValues): Promise<ActionResult> {
	const month = values.month ?? "";
	if (!isMonth(month)) return { state: failed(prev, values, {}, "Choose a month.") };
	const current = await listMonth(db, month);
	if (current.some((r) => r.kind === "cost")) return { state: failed(prev, values, {}, "This month already has costs, so nothing was copied.") };
	const last = (await listMonth(db, previousMonth(month))).filter((r) => r.kind === "cost");
	if (!last.length) return { state: failed(prev, values, {}, "Last month has no costs to copy.") };
	await replaceMonth(db, month, [...current, ...last]);
	// The copy form goes once the month has costs, so the message is shown by the page.
	return { state: ok(prev, "Copied."), redirectTo: adminHref(`/settings/money?month=${month}&copied=${last.length}`) };
}

// --- Icon -------------------------------------------------------------------------------

const KIND_LABEL = { svg: "its SVG icon", "apple-touch-icon": "its apple-touch-icon", manifest: "its web manifest", favicon: "its favicon" } as const;

/** "Refresh icon now": checks the project's live site for its current icon and stores it if it changed. */
export async function refreshIconCore(db: D1Database, prev: FormState, values: FormValues, ctx: Context & { fetch?: typeof fetch }): Promise<ActionResult> {
	const project = await projectFrom(db, values);
	if (!project) return missing(prev);
	const result = await refreshProjectIcon(db, ctx.fetch ?? fetch, project, ctx.now);
	if (result.status === "none") return { state: failed(prev, values, {}, `No icon found: ${result.error ?? "nothing usable on the site"} The current icon is kept.`) };
	const from = result.kind ? KIND_LABEL[result.kind] : "the site";
	const message = result.status === "same" ? `The icon is up to date (from ${from}).` : `Icon ${result.status === "new" ? "saved" : "updated"}: ${from}.`;
	return { state: ok(prev, message, result.sourceUrl ? [result.sourceUrl] : []) };
}
