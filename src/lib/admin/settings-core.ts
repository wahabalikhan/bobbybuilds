/**
 * The logic behind every settings action, without Next.js: each takes the database, the previous
 * form state and the submitted values, and returns the new state (and sometimes where to go next).
 * src/app/admin/settings/actions.ts wraps these, checking admin access first.
 */
import { listProjects, setProjectKeys, type Project } from "@/lib/db/projects";
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
	setOrigins,
	SlugTakenError,
	updateProjectDetails,
} from "@/lib/db/settings";
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
	type FormValues,
} from "./validate";

export type ActionResult = { state: FormState; redirectTo?: string };
type Context = { logos: string[]; now: number };

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
	// links, order, logo, health address, GitHub repo), so saving never wipes or renames them.
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
	try {
		await updateProjectDetails(db, project.id, result.value);
	} catch (error) {
		if (error instanceof SlugTakenError) return { state: failed(prev, values, { slug: "Another project already uses this slug." }) };
		throw error;
	}
	const notes = result.value.slug !== project.slug ? ["The slug changed, so this page's address changed too."] : [];
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
	const taken = new Set(["new", ...(await listProjects(db)).map((p) => p.slug)]);
	let slug = result.value.slug;
	for (let n = 2; taken.has(slug); n += 1) slug = `${result.value.slug.slice(0, 36)}-${n}`;

	const id = await createProject(db, {
		name,
		slug,
		tagline: "",
		descriptionMd: "",
		status: "building",
		lesson: null,
		logoPath: null,
		siteUrl,
		healthUrl: siteUrl,
		githubRepo: null,
		links: [],
		sortOrder: 0,
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
	const notes = headline && !publicIds.includes(headline) ? ["The headline number is shown on the public card, so it was made public too."] : [];
	return { state: ok(prev, "Public numbers saved.", notes) };
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
	try {
		const saved = await saveJourney(db, id, result.value);
		const message = result.value.publish ? "Saved and published." : "Saved as a draft.";
		return { state: ok(prev, message), redirectTo: id === null ? adminHref(`/settings/journey/${saved}?created=1`) : undefined };
	} catch (error) {
		if (error instanceof SlugTakenError) return { state: failed(prev, values, { slug: "Another entry already uses this slug." }) };
		throw error;
	}
}

