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
	deleteMilestone,
	deleteProject,
	saveJourney,
	saveMilestone,
	setBrowserEvents,
	setFunnel,
	setMetricVisibility,
	setOrigins,
	SlugTakenError,
	updateProjectDetails,
} from "@/lib/db/settings";
import { createPublicKey, createSecretKey, hashSecretKey, secretKeyHint } from "@/lib/keys";
import { adminHref } from "@/lib/site";
import { failed, ok, type FormState } from "./form-state";
import {
	validateBrowserEvents,
	validateFunnel,
	validateJourney,
	validateMilestone,
	validateNewMetric,
	validateOrigins,
	validateProjectDetails,
	type FormValues,
} from "./validate";

export type ActionResult = { state: FormState; redirectTo?: string };
type Context = { logos: string[]; now: number };

const settingsHref = (slug: string, section = "details") => adminHref(`/settings/projects/${slug}?section=${section}`);

async function projectFrom(db: D1Database, values: FormValues): Promise<Project | null> {
	const id = Number(values.project_id);
	if (!Number.isInteger(id) || id <= 0) return null;
	return (await listProjects(db)).find((p) => p.id === id) ?? null;
}

const missing = (prev: FormState): ActionResult => ({ state: { status: "error", version: prev.version + 1, message: "That project no longer exists." } });

// --- Projects ---------------------------------------------------------------------------

export async function createProjectCore(db: D1Database, prev: FormState, values: FormValues, ctx: Context): Promise<ActionResult> {
	const result = validateProjectDetails(values, ctx.logos);
	if (!result.ok) return { state: failed(prev, values, result.errors) };
	try {
		await createProject(db, result.value);
	} catch (error) {
		if (error instanceof SlugTakenError) return { state: failed(prev, values, { slug: "Another project already uses this slug." }) };
		throw error;
	}
	return { state: ok(prev, "Project created."), redirectTo: settingsHref(result.value.slug, "keys") };
}

export async function saveDetailsCore(db: D1Database, prev: FormState, values: FormValues, ctx: Context): Promise<ActionResult> {
	const project = await projectFrom(db, values);
	if (!project) return missing(prev);
	const result = validateProjectDetails(values, ctx.logos);
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
		redirectTo: result.value.slug !== project.slug ? settingsHref(result.value.slug, "details") : undefined,
	};
}

export async function deleteProjectCore(db: D1Database, prev: FormState, values: FormValues): Promise<ActionResult> {
	const project = await projectFrom(db, values);
	if (!project) return missing(prev);
	if ((values.confirm_slug ?? "").trim() !== project.slug) {
		return { state: failed(prev, values, { confirm_slug: `Type ${project.slug} to confirm.` }, "Nothing was deleted.") };
	}
	await deleteProject(db, project.id);
	return { state: ok(prev, `${project.name} was deleted.`), redirectTo: adminHref("/settings?deleted=1") };
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

// --- Milestones -------------------------------------------------------------------------

export async function milestoneCore(db: D1Database, prev: FormState, values: FormValues): Promise<ActionResult> {
	const project = await projectFrom(db, values);
	if (!project) return missing(prev);
	if (values.intent === "delete") {
		await deleteMilestone(db, project.id, Number(values.milestone_id));
		return { state: ok(prev, "Milestone deleted.") };
	}
	const result = validateMilestone(values);
	if (!result.ok) return { state: failed(prev, values, result.errors) };
	await saveMilestone(db, project.id, values.milestone_id ? Number(values.milestone_id) : null, result.value);
	return { state: ok(prev, values.milestone_id ? "Milestone saved." : "Milestone added.") };
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

