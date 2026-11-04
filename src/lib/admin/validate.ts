/**
 * Validation for the settings forms. Limits match the CHECK constraints in migrations/.
 * Each validator takes plain strings (from FormData) and returns either clean values or
 * friendly, field-by-field errors in UK English.
 */
import { BUILT_IN_EVENTS, isEventName } from "@/lib/collector/validate";
import { isDay } from "@/lib/days";
import type { FunnelStep } from "@/lib/db/funnel";
import type { ProjectLink, ProjectStatus } from "@/lib/db/projects";

export type Errors = Record<string, string>;
export type Result<T> = { ok: true; value: T; notes?: string[] } | { ok: false; errors: Errors };

const STATUSES: ProjectStatus[] = ["live", "building", "idea", "retired"];

const text = (value: FormDataEntryValue | null | undefined) => (typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "");

export type FormValues = Record<string, string>;

/** FormData to plain strings (files ignored). */
export function formValues(form: FormData): FormValues {
	const values: FormValues = {};
	for (const [key, value] of form.entries()) if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
	return values;
}

export function slugify(value: string, max = 40): string {
	return value
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, max)
		.replace(/-+$/g, "");
}

function httpsUrl(value: string, field: string, errors: Errors, label: string): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		if (url.protocol !== "https:") throw new Error();
		if (value.length > 300) {
			errors[field] = `${label} must be 300 characters or fewer.`;
			return null;
		}
		return url.toString();
	} catch {
		errors[field] = `${label} must be a full https:// address.`;
		return null;
	}
}

// --- Project details --------------------------------------------------------------------

export type ProjectDetails = {
	name: string;
	slug: string;
	tagline: string;
	taglineFallback: string;
	descriptionMd: string;
	status: ProjectStatus;
	lesson: string | null;
	logoPath: string | null;
	siteUrl: string | null;
	healthUrl: string | null;
	githubRepo: string | null;
	links: ProjectLink[];
	sortOrder: number;
};

/**
 * Links come from a textarea, one per line: "Label | https://address".
 */
export function parseLinks(value: string, errors: Errors): ProjectLink[] {
	const links: ProjectLink[] = [];
	const lines = value.split("\n").map((l) => l.trim()).filter(Boolean);
	if (lines.length > 8) errors.links = "Add up to 8 links.";
	for (const [i, line] of lines.slice(0, 8).entries()) {
		const [label, url] = line.split("|").map((part) => part.trim());
		if (!label || !url || label.length > 40) {
			errors.links = `Line ${i + 1}: write each link as "Label | https://address", with a label of up to 40 characters.`;
			continue;
		}
		try {
			const parsed = new URL(url);
			if (parsed.protocol !== "https:" && parsed.protocol !== "mailto:") throw new Error();
			links.push({ label, url: parsed.toString() });
		} catch {
			errors.links = `Line ${i + 1}: "${url.slice(0, 60)}" isn't a full https:// or mailto: address.`;
		}
	}
	return links;
}

export function validateProjectDetails(values: FormValues, logos: string[]): Result<ProjectDetails> {
	const errors: Errors = {};
	const name = text(values.name);
	if (!name) errors.name = "Give the project a name.";
	else if (name.length > 60) errors.name = "Keep the name to 60 characters or fewer.";

	const slug = text(values.slug) || slugify(name);
	if (!/^[a-z0-9-]{1,40}$/.test(slug)) errors.slug = "Use lower-case letters, numbers and hyphens only, up to 40 characters.";

	const tagline = text(values.tagline);
	if (tagline.length > 120) errors.tagline = `Keep the tagline to one line: 120 characters or fewer (this is ${tagline.length}).`;

	const taglineFallback = text(values.tagline_fallback);
	if (taglineFallback.length > 120) errors.tagline_fallback = `Keep the fallback tagline to 120 characters or fewer (this is ${taglineFallback.length}).`;

	const descriptionMd = text(values.description_md);
	if (descriptionMd.length > 20_000) errors.description_md = "The description must be 20,000 characters or fewer.";

	const status = text(values.status) as ProjectStatus;
	if (!STATUSES.includes(status)) errors.status = "Choose a status.";

	const lesson = text(values.lesson);
	if (lesson.length > 160) errors.lesson = "Keep the lesson to 160 characters or fewer.";

	const logo = text(values.logo_path);
	if (logo && !logos.includes(logo)) errors.logo_path = "Choose a logo from the list (add image files to public/logos/).";

	const githubRepo = text(values.github_repo).replace(/^https:\/\/github\.com\//, "").replace(/\/+$/, "");
	if (githubRepo && !/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(githubRepo)) errors.github_repo = 'Write it as "owner/repo", e.g. wahabalikhan/portfolio.';

	const sortOrder = Number(text(values.sort_order) || "0");
	if (!Number.isInteger(sortOrder) || sortOrder < -1000 || sortOrder > 1000) errors.sort_order = "Use a whole number between -1000 and 1000.";

	const value: ProjectDetails = {
		name,
		slug,
		tagline,
		taglineFallback,
		descriptionMd,
		status,
		lesson: lesson || null,
		logoPath: logo || null,
		siteUrl: httpsUrl(text(values.site_url), "site_url", errors, "The site address"),
		healthUrl: httpsUrl(text(values.health_url), "health_url", errors, "The health address"),
		githubRepo: githubRepo || null,
		links: parseLinks(text(values.links), errors),
		sortOrder,
	};
	return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

// --- Origins ----------------------------------------------------------------------------

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** One origin per line. Exact origins only: scheme, host and optional port; https except localhost. */
export function validateOrigins(value: string, siteUrl: string | null): Result<string[]> {
	const errors: Errors = {};
	const origins: string[] = [];
	const lines = value.split(/[\n,]/).map((l) => l.trim()).filter(Boolean);
	if (lines.length > 10) errors.origins = "Add up to 10 origins.";
	for (const line of lines.slice(0, 10)) {
		let url: URL;
		try {
			url = new URL(line);
		} catch {
			errors.origins = `"${line.slice(0, 80)}" isn't an address. Write it like https://example.com`;
			continue;
		}
		const bare = line.replace(/\/$/, "");
		if (url.pathname !== "/" || url.search || url.hash || bare !== url.origin) {
			errors.origins = `"${line.slice(0, 80)}" has a path or extra parts. An origin is just the scheme, host and port, like ${url.origin}`;
			continue;
		}
		if (url.protocol !== "https:" && !(url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname))) {
			errors.origins = `"${url.origin}" must use https:// (plain http is only allowed for localhost).`;
			continue;
		}
		if (!origins.includes(url.origin)) origins.push(url.origin);
	}
	if (Object.keys(errors).length) return { ok: false, errors };

	const notes: string[] = [];
	if (siteUrl) {
		const siteOrigin = new URL(siteUrl).origin;
		if (!origins.includes(siteOrigin)) notes.push(`The site address's origin (${siteOrigin}) isn't in the list, so page views from it will be refused.`);
	}
	if (origins.length === 0) notes.push("With no origins, every browser request for this project is refused.");
	return { ok: true, value: origins, notes };
}

// --- Browser events and funnel ----------------------------------------------------------

/** Event names, separated by commas or new lines. Built-in events are always on, so they're dropped. */
export function validateBrowserEvents(value: string): Result<string[]> {
	const names = value.split(/[\s,]+/).map((n) => n.trim()).filter(Boolean);
	const bad = names.filter((n) => !isEventName(n));
	if (bad.length) return { ok: false, errors: { browser_events: `These names aren't allowed: ${bad.slice(0, 5).join(", ")}. Use lower-case letters, numbers, _ . or -, starting with a letter.` } };
	const unique = [...new Set(names)].filter((n) => !(n in BUILT_IN_EVENTS));
	if (unique.length > 30) return { ok: false, errors: { browser_events: "Add up to 30 event names." } };
	const skipped = [...new Set(names)].filter((n) => n in BUILT_IN_EVENTS);
	return { ok: true, value: unique, notes: skipped.length ? [`${skipped.join(", ")} ${skipped.length === 1 ? "is" : "are"} built in, so always allowed.`] : [] };
}

export const FUNNEL_ROWS = 8;

/** Funnel rows step_label_N, step_kind_N ("page" | "event"), step_value_N. Empty rows are skipped. */
export function validateFunnel(values: FormValues): Result<FunnelStep[]> {
	const errors: Errors = {};
	const steps: FunnelStep[] = [];
	for (let i = 0; i < FUNNEL_ROWS; i += 1) {
		const label = text(values[`step_label_${i}`]);
		const kind = text(values[`step_kind_${i}`]);
		const value = text(values[`step_value_${i}`]);
		if (!label && !value) continue;
		if (!label || label.length > 40) {
			errors[`step_${i}`] = `Step ${steps.length + 1}: add a label of up to 40 characters.`;
			continue;
		}
		if (kind === "event") {
			if (!isEventName(value)) errors[`step_${i}`] = `Step ${steps.length + 1}: "${String(value).slice(0, 40)}" isn't an event name.`;
			else steps.push({ label, event: value });
		} else {
			if (!/^\/[^\s?#]{0,199}$/.test(value)) errors[`step_${i}`] = `Step ${steps.length + 1}: a page is a path starting with /, with no query string.`;
			else steps.push({ label, path: value });
		}
	}
	return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: steps };
}

// --- Numbers ----------------------------------------------------------------------------

export type NewMetric = { key: string; label: string; unit: string; source: "product" | "event"; eventName: string | null };

export function validateNewMetric(values: FormValues): Result<NewMetric> {
	const errors: Errors = {};
	const source = text(values.source) === "event" ? "event" : "product";
	const label = text(values.label);
	if (!label || label.length > 60) errors.label = "Add a label of up to 60 characters.";
	const key = text(values.key) || slugify(label).replace(/-/g, "_");
	if (!/^[a-z][a-z0-9_]{0,39}$/.test(key)) errors.key = "The key must start with a letter and use lower-case letters, numbers and _ only (up to 40).";
	if (["visitors", "pageviews", "repeat_visitors"].includes(key)) errors.key = "That key is built in. Choose another.";
	const unit = text(values.unit);
	if (unit.length > 20) errors.unit = "Keep the unit to 20 characters or fewer.";
	const eventName = source === "event" ? text(values.event_name) : null;
	if (source === "event" && !isEventName(eventName)) errors.event_name = "Choose the event to count.";
	return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { key, label, unit, source, eventName } };
}

// --- Journey entries and milestones -----------------------------------------------------

export type JourneyInput = { title: string; slug: string; bodyMd: string; projectId: number | null; publish: boolean; publishedAt: number | null };

export function validateJourney(values: FormValues, projectIds: number[], now: number): Result<JourneyInput> {
	const errors: Errors = {};
	const title = text(values.title);
	if (!title || title.length > 120) errors.title = "Add a title of up to 120 characters.";
	const slug = text(values.slug) || slugify(title, 80);
	if (!/^[a-z0-9-]{1,80}$/.test(slug)) errors.slug = "Use lower-case letters, numbers and hyphens only, up to 80 characters.";
	const bodyMd = text(values.body_md);
	if (bodyMd.length > 50_000) errors.body_md = "Keep the entry to 50,000 characters or fewer.";
	const projectId = text(values.project_id) ? Number(values.project_id) : null;
	if (projectId !== null && !projectIds.includes(projectId)) errors.project_id = "Choose a project from the list.";
	const publish = values.publish === "on";
	let publishedAt: number | null = null;
	if (publish) {
		const day = text(values.published_on);
		if (day && !isDay(day)) errors.published_on = "Choose a date.";
		publishedAt = day && isDay(day) ? Date.parse(`${day}T09:00:00Z`) : now;
	}
	return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { title, slug, bodyMd, projectId, publish, publishedAt } };
}

export type MilestoneInput = { day: string; title: string; note: string; isPublic: boolean };

export function validateMilestone(values: FormValues): Result<MilestoneInput> {
	const errors: Errors = {};
	const day = text(values.day);
	if (!isDay(day)) errors.day = "Choose a date.";
	const title = text(values.title);
	if (!title || title.length > 120) errors.title = "Add a title of up to 120 characters.";
	const note = text(values.note);
	if (note.length > 500) errors.note = "Keep the note to 500 characters or fewer.";
	return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { day, title, note, isPublic: values.is_public === "on" } };
}

export type NewProjectStart = { name: string; slug: string; siteUrl: string; origin: string };

/**
 * Step 1 of the new project setup: a name and the site's address. The slug is made from the name
 * ("Tech Jobs" → tech-jobs) and the allowed origin from the address (https://example.com/a → https://example.com).
 */
export function validateNewProject(values: FormValues): Result<NewProjectStart> {
	const errors: Errors = {};
	const name = text(values.name);
	if (!name) errors.name = "Give the project a name.";
	else if (name.length > 60) errors.name = "Keep the name to 60 characters or fewer.";
	const slug = slugify(name);
	if (name && !slug) errors.name = "Use at least one letter or number in the name.";
	const siteUrl = httpsUrl(text(values.site_url), "site_url", errors, "The site address");
	if (!text(values.site_url)) errors.site_url = "Add the site's address, like https://example.com.";
	if (Object.keys(errors).length || !siteUrl) return { ok: false, errors };
	return { ok: true, value: { name, slug, siteUrl, origin: new URL(siteUrl).origin } };
}
