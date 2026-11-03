"use server";

/**
 * Settings server actions. Every one starts with requireAdmin(): server actions can be called
 * from any page, so the middleware's /admin path check isn't enough on its own.
 * (tests/node/actions.test.ts fails if an action here doesn't.)
 * The logic lives in src/lib/admin/settings-core.ts.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireAdmin } from "@/lib/admin/access";
import type { FormState } from "@/lib/admin/form-state";
import * as core from "@/lib/admin/settings-core";
import { formValues } from "@/lib/admin/validate";
import { LOGOS } from "@/lib/logos.generated";
import { utcDay } from "@/lib/days";
import { renderMarkdown } from "@/lib/markdown";
import { publishSnapshot } from "@/lib/public/snapshot";
import { adminHref } from "@/lib/site";

type Core = (db: D1Database, prev: FormState, values: Record<string, string>, ctx: { logos: string[]; now: number }) => Promise<core.ActionResult>;

async function run(prev: FormState, form: FormData, fn: Core): Promise<FormState> {
	const { env } = await getCloudflareContext({ async: true });
	const result = await fn(env.DB, prev, formValues(form), { logos: LOGOS, now: Date.now() });
	if (result.state.status === "ok") {
		// Show the change on the public pages straight away (written only if it changed them).
		try {
			await publishSnapshot(env.DB, env.PUBLIC_CACHE, utcDay());
		} catch {
			result.state.notes = [...(result.state.notes ?? []), "Saved, but the public pages couldn't be refreshed yet. They'll catch up within 10 minutes."];
		}
	}
	revalidatePath(adminHref(), "layout");
	if (result.redirectTo) redirect(result.redirectTo);
	return result.state;
}

/** New project, step 1 (name and address): makes the project, its origin and its keys. */
export async function startProjectAction(prev: FormState, form: FormData) {
	await requireAdmin();
	return run(prev, form, core.startProjectCore);
}

export async function saveDetailsAction(prev: FormState, form: FormData) {
	await requireAdmin();
	return run(prev, form, core.saveDetailsCore);
}

export async function deleteProjectAction(prev: FormState, form: FormData) {
	await requireAdmin();
	return run(prev, form, core.deleteProjectCore);
}

export async function keysAction(prev: FormState, form: FormData) {
	await requireAdmin();
	return run(prev, form, core.keysCore);
}

export async function originsAction(prev: FormState, form: FormData) {
	await requireAdmin();
	return run(prev, form, core.originsCore);
}

export async function eventsAction(prev: FormState, form: FormData) {
	await requireAdmin();
	return run(prev, form, core.eventsCore);
}

export async function funnelAction(prev: FormState, form: FormData) {
	await requireAdmin();
	return run(prev, form, core.funnelCore);
}

export async function visibilityAction(prev: FormState, form: FormData) {
	await requireAdmin();
	return run(prev, form, core.visibilityCore);
}

export async function addMetricAction(prev: FormState, form: FormData) {
	await requireAdmin();
	return run(prev, form, core.addMetricCore);
}

export async function deleteMetricAction(prev: FormState, form: FormData) {
	await requireAdmin();
	return run(prev, form, core.deleteMetricCore);
}

export async function journeyAction(prev: FormState, form: FormData) {
	await requireAdmin();
	return run(prev, form, core.journeyCore);
}

/** Markdown preview for the journey editor, with the same sanitising as the public pages. */
export async function previewMarkdownAction(source: string): Promise<string> {
	await requireAdmin();
	return renderMarkdown(typeof source === "string" ? source : "");
}
