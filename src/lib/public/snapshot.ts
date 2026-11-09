/**
 * The public snapshot: everything the public pages show, in one JSON value in KV.
 *
 * - Built ONLY from the daily roll-ups, public numbers, published journey entries, public
 *   milestones, the profile, monthly costs and revenue, each project's latest uptime check (up or
 *   down, for its status dot) and (when "Show my activity" is on) the GitHub contribution calendar. Never from raw page views or events, and never from private numbers.
 * - Only projects with "Show on my public page" on (listPublicProjects). A hidden project (like
 *   BobbyBuilds itself) is in nothing here: no card, chart, totals, or journey entry's project name.
 * - Rebuilt by the 5-minute job every 10 minutes (with today's roll-up), by the daily job, and
 *   after settings changes. Written to KV only when it has changed, so writes stay far below the
 *   free plan's 1,000 a day (at most ~144, usually far fewer).
 * - Public pages read it with one KV read; if it's missing (first deploy) they build it once.
 */
import { addDays, weekStart } from "@/lib/days";
import { latestUptime, listMetrics, metricSeries, type Metric } from "@/lib/db/dashboard";
import { iconPath, listIcons, toBase64 } from "@/lib/db/icons";
import { listMonth, monthlyPence, monthTotals, type CostGroup } from "@/lib/db/money";
import { getProfile } from "@/lib/db/profile";
import { firstTrackedDays, listPublicProjects, type ProjectLink, type ProjectStatus } from "@/lib/db/projects";
import { chartStart, trendFrom, type Trend } from "@/lib/trend";
import type { JourneyType } from "@/lib/journey-types";
import { sha256Hex } from "@/lib/keys";
import { renderMarkdown } from "@/lib/markdown";
import { hasPinnedLogo, logoFor } from "@/lib/project-logo";
import { owner } from "@/lib/site";
import { fillOutcome, fillTaglineParts, type TaglinePart } from "./product-line";

export const SNAPSHOT_KEY = "public-snapshot";
export const SNAPSHOT_VERSION = 11;

/** The first month any product existed: the combined visitors trend starts here, not 12 months back. */
export const FIRST_PRODUCT_MONTH = "2026-10";

export type Point = { day: string; value: number };
export type Month = { month: string; value: number };

export type PublicNumber = {
	key: string;
	label: string;
	unit: string;
	kind: "count" | "latest";
	/** 30-day total for counts, latest value for product numbers. */
	figure: number | null;
	/** The day of the latest value (product numbers), so stale ones can be hidden. */
	latestDay: string | null;
	period: string;
	/** Weekly totals for 12 weeks (counts), or daily values for 90 days (product numbers). */
	series: Point[];
	seriesKind: "weekly" | "daily";
};

export type PublicProject = {
	slug: string;
	name: string;
	/** The tagline as plain text, with any numbers filled in. */
	tagline: string;
	/** The same, in pieces, so the card can show the numbers in bold. */
	taglineParts: TaglinePart[];
	status: ProjectStatus;
	lesson: string | null;
	logoPath: string | null;
	siteUrl: string | null;
	links: ProjectLink[];
	descriptionHtml: string;
	/** The number in the card's pill, when one is public. */
	pill: { label: string; unit: string; value: number; period: string } | null;
	/** Visitors per week for 12 weeks (last = this week so far); null when visitors aren't public. */
	weekly: Point[] | null;
	/** The card's chart: from the project's start (per day for its first four weeks, then per week); null when visitors aren't public. */
	trend: Trend | null;
	/** Its first tracked day and its live date ("Started on"), for the note under the chart. */
	trackingSince: string | null;
	liveSince: string | null;
	/** Visitors per month for 12 months; null when visitors aren't public. */
	monthly: Month[] | null;
	numbers: PublicNumber[];
	milestones: { day: string; title: string; note: string }[];
	/** "" = none. */
	emoji: string;
	/** The hero screenshot from public/screenshots/, always with alt text. */
	screenshot: { src: string; alt: string } | null;
	caseStudyUrl: string | null;
	/** Filled-in outcomes (numbers marked), in order; ones that can't be filled are left out. */
	outcomes: TaglinePart[][];
	/** Shown after "Now:" in the card. "" = none. */
	now: string;
	/** Its latest uptime check in the last day: true up, false down, null when there's none (the status dot pulses only while it's up). */
	up: boolean | null;
};

export type PublicEntry = {
	slug: string;
	type: JourneyType;
	/** 'YYYY-MM-DD': the date shown. */
	day: string;
	title: string;
	linkUrl: string | null;
	publishedAt: number;
	projectSlug: string | null;
	projectName: string | null;
	html: string;
	excerpt: string;
};

/** GitHub's contribution calendar for the last year: counts per day from firstDay (public data), with its total and longest streak. */
export type PublicGithub = { login: string; firstDay: string; counts: number[]; total: number; longestStreak: number };

/**
 * The Activity section (only when "Show my activity" is on in Profile): Shipped journey entries
 * per month for the last 12 months (this month last), and the GitHub contribution calendar.
 */
export type PublicActivity = { shipped: { month: string; titles: string[] }[]; github: PublicGithub | null };

/** One line of costs: its monthly share, and for a yearly bill the yearly price it comes from. */
export type PublicCost = { service: string; pence: number; yearlyPence: number | null };

/**
 * The latest month with any costs or revenue entered (this month, or the one before that was
 * filled in). Costs are in two groups with their own totals: running costs (what keeps the
 * products live) and tools I build with. Every amount is per month (yearly bills ÷ 12).
 */
export type PublicMoney = { month: string; runningPence: number; toolsPence: number; revenuePence: number; running: PublicCost[]; tools: PublicCost[] };

export type PublicSnapshot = {
	version: number;
	generatedAt: number;
	today: string;
	/** Visitors per month across projects whose visitors are public, from FIRST_PRODUCT_MONTH (at most 12 months). */
	monthly: Month[];
	/** Visitors in the last 30 days across projects whose visitors are public. */
	visitors30: number;
	profile: { buildingSince: string | null };
	money: PublicMoney | null;
	projects: PublicProject[];
	journey: PublicEntry[];
	activity: PublicActivity | null;
	/** Each public project's stored icon (fetched from its own site), by its URL path (/i/<slug>-<hash>.<ext>), served by src/app/i/[file]/route.ts. */
	icons: Record<string, { contentType: string; base64: string }>;
};

const sum = (points: { value: number }[]) => points.reduce((t, p) => t + p.value, 0);

function months(today: string): string[] {
	const [year, month] = today.split("-").map(Number);
	return Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(year, month - 1 - (11 - i), 1)).toISOString().slice(0, 7));
}

function toWeeks(daily: Point[], today: string): Point[] {
	const first = addDays(weekStart(today), -7 * 11);
	return Array.from({ length: 12 }, (_, i) => {
		const week = addDays(first, 7 * i);
		const end = addDays(week, 6);
		return { day: week, value: sum(daily.filter((d) => d.day >= week && d.day <= end)) };
	});
}

function toMonths(daily: Point[], today: string): Month[] {
	return months(today).map((m) => ({ month: m, value: sum(daily.filter((d) => d.day.startsWith(m))) }));
}

/** Plain-text first paragraph (skipping headings), for listings and share cards. */
export function excerpt(markdown: string, max = 180): string {
	const paragraph = markdown.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^(#|```|[-*+] |\d+\. |>|!\[)/.test(p)) ?? "";
	const text = paragraph
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/[#>*_`~|-]+/g, " ")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return text.length > max ? `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…` : text;
}

async function publicNumber(db: D1Database, metric: Metric, today: string): Promise<PublicNumber> {
	if (metric.source === "product") {
		const series = await metricSeries(db, metric, addDays(today, -89), today);
		const latest = await db
			.prepare("SELECT value, day FROM metric_values WHERE metric_id = ?1 AND day <= ?2 ORDER BY day DESC LIMIT 1")
			.bind(metric.id, today)
			.first<{ value: number; day: string }>();
		return { key: metric.key, label: metric.label, unit: metric.unit, kind: "latest", figure: latest?.value ?? null, latestDay: latest?.day ?? null, period: "latest", series, seriesKind: "daily" };
	}
	const daily = await metricSeries(db, metric, addDays(weekStart(today), -7 * 11), today);
	return {
		key: metric.key,
		label: metric.label,
		unit: metric.unit,
		kind: "count",
		figure: sum(daily.filter((d) => d.day >= addDays(today, -29))),
		latestDay: null,
		period: "last 30 days",
		series: toWeeks(daily, today),
		seriesKind: "weekly",
	};
}

/** Builds the snapshot from the roll-ups and public settings only. */
export async function buildSnapshot(db: D1Database, today: string, now: number = Date.now()): Promise<PublicSnapshot> {
	const [projects, metrics, profile, firstTracked, uptime, storedIcons] = await Promise.all([listPublicProjects(db), listMetrics(db), getProfile(db), firstTrackedDays(db), latestUptime(db, now), listIcons(db)]);
	const icons: PublicSnapshot["icons"] = {};
	const firstMonthDay = `${months(today)[0]}-01`;

	const publicProjects: PublicProject[] = [];
	for (const project of projects) {
		const own = metrics.filter((m) => m.projectId === project.id && m.isPublic);
		const visitorsMetric = own.find((m) => m.source === "collector" && m.key === "visitors");
		const visitorsDaily = visitorsMetric ? await metricSeries(db, visitorsMetric, firstMonthDay, today) : null;
		const numbers = await Promise.all(own.map((m) => publicNumber(db, m, today)));
		const headline = own.find((m) => m.isHeadline);
		// Filled in here, so the public page only ever sees the finished text, never {placeholders}.
		const taglineParts = fillTaglineParts(project.tagline, project.taglineFallback, numbers, today);
		const headlineNumber = headline ? numbers[own.indexOf(headline)] : null;

		const { results: milestones } = await db
			.prepare("SELECT day, title, note FROM milestones WHERE project_id = ?1 AND is_public = 1 ORDER BY day DESC, id DESC")
			.bind(project.id)
			.all<{ day: string; title: string; note: string }>();

		publicProjects.push({
			slug: project.slug,
			name: project.name,
			tagline: taglineParts.map((p) => p.text).join(""),
			taglineParts,
			status: project.status,
			lesson: project.lesson,
			// Its pinned file in public/logos (PINNED_LOGOS), else its own current icon when one has been
			// fetched, else its file in public/logos, else its initial.
			logoPath: (() => {
				const icon = hasPinnedLogo(project) ? undefined : storedIcons.get(project.id);
				if (!icon) return logoFor(project);
				const path = iconPath(project.slug, icon);
				icons[path] = { contentType: icon.contentType, base64: toBase64(icon.data) };
				return path;
			})(),
			siteUrl: project.siteUrl,
			links: project.links,
			descriptionHtml: renderMarkdown(project.descriptionMd),
			pill: headline && headlineNumber?.figure != null ? { label: headline.label, unit: headline.unit, value: headlineNumber.figure, period: headlineNumber.period } : null,
			weekly: visitorsDaily ? toWeeks(visitorsDaily, today) : null,
			trend: visitorsDaily ? trendFrom(visitorsDaily, today, chartStart(project.startedOn, firstTracked.get(project.id) ?? null)) : null,
			trackingSince: firstTracked.get(project.id) ?? null,
			liveSince: project.startedOn,
			monthly: visitorsDaily ? toMonths(visitorsDaily, today) : null,
			numbers,
			milestones,
			emoji: project.emoji,
			screenshot: project.screenshotPath && project.screenshotAlt ? { src: project.screenshotPath, alt: project.screenshotAlt } : null,
			caseStudyUrl: project.caseStudyUrl,
			outcomes: project.outcomes.map((o) => fillOutcome(o, numbers, today)).filter((o): o is TaglinePart[] => o !== null),
			now: project.nowText,
			up: uptime.get(project.id) ?? null,
		});
	}

	const monthly = months(today).filter((month) => month >= FIRST_PRODUCT_MONTH).map((month) => ({
		month,
		value: sum(publicProjects.flatMap((p) => p.monthly?.filter((m) => m.month === month) ?? [])),
	}));

	// An entry about a hidden project is still public, without naming the project.
	const { results: entries } = await db
		.prepare(
			`SELECT j.slug, j.type, j.title, j.body_md, j.link_url, j.published_at, p.slug AS project_slug, p.name AS project_name
			 FROM journey_entries j LEFT JOIN projects p ON p.id = j.project_id AND p.show_public = 1
			 WHERE j.is_published = 1 AND j.published_at IS NOT NULL AND j.published_at <= ?1
			 ORDER BY j.published_at DESC, j.id DESC`,
		)
		.bind(now)
		.all<{ slug: string; type: JourneyType; title: string; body_md: string; link_url: string | null; published_at: number; project_slug: string | null; project_name: string | null }>();

	const visitors30 = sum(publicProjects.flatMap((p) => p.numbers.filter((n) => n.kind === "count" && n.key === "visitors").map((n) => ({ value: n.figure ?? 0 }))));

	return {
		version: SNAPSHOT_VERSION,
		generatedAt: now,
		today,
		monthly,
		visitors30,
		profile: { buildingSince: profile.buildingSince },
		money: await publicMoney(db, today.slice(0, 7)),
		projects: publicProjects,
		journey: entries.map((e) => ({
			slug: e.slug,
			type: e.type,
			day: new Date(e.published_at).toISOString().slice(0, 10),
			title: e.title,
			linkUrl: e.link_url,
			publishedAt: e.published_at,
			projectSlug: e.project_slug,
			projectName: e.project_name,
			html: renderMarkdown(e.body_md),
			excerpt: excerpt(e.body_md),
		})),
		// Always shown (the "Show my activity" switch was removed; profile.show_shipping_rhythm is unused).
		activity: await activity(db, today, entries),
		icons,
	};
}

/** This month's costs and revenue, or the latest month before it that has any. */
async function publicMoney(db: D1Database, thisMonth: string): Promise<PublicMoney | null> {
	const latest = await db.prepare("SELECT max(month) AS month FROM money WHERE month <= ?1").bind(thisMonth).first<{ month: string | null }>();
	if (!latest?.month) return null;
	const rows = await listMonth(db, latest.month);
	const group = (keep: CostGroup): PublicCost[] => {
		const lines = new Map<string, PublicCost>();
		for (const r of rows.filter((r) => r.kind === "cost" && r.group === keep)) {
			// One line per service and billing (a service on several projects is added up).
			const key = `${r.service.toLowerCase()}|${r.billing}`;
			const line = lines.get(key) ?? { service: r.service, pence: 0, yearlyPence: r.billing === "yearly" ? 0 : null };
			line.pence += monthlyPence(r);
			if (line.yearlyPence !== null) line.yearlyPence += r.amountPence;
			lines.set(key, line);
		}
		return [...lines.values()].sort((a, b) => b.pence - a.pence || a.service.localeCompare(b.service, "en-GB", { sensitivity: "base" }));
	};
	return { month: latest.month, ...monthTotals(rows), running: group("running"), tools: group("tools") };
}

/** Shipped entries per month (from the published entries) and the GitHub calendar (see PublicActivity). */
async function activity(db: D1Database, today: string, entries: { type: JourneyType; title: string; published_at: number }[]): Promise<PublicActivity> {
	const shipped = months(today).map((month) => ({
		month,
		titles: entries.filter((e) => e.type === "shipped" && new Date(e.published_at).toISOString().startsWith(month)).map((e) => e.title),
	}));
	const { results } = await db.prepare("SELECT day, count FROM github_contributions ORDER BY day").all<{ day: string; count: number }>();
	let longestStreak = 0;
	let run = 0;
	for (const r of results) {
		run = r.count > 0 ? run + 1 : 0;
		longestStreak = Math.max(longestStreak, run);
	}
	const github: PublicGithub | null = results.length
		? { login: owner.githubLogin, firstDay: results[0].day, counts: results.map((r) => r.count), total: sum(results.map((r) => ({ value: r.count }))), longestStreak }
		: null;
	return { shipped, github };
}

/** Hash of the content (not the time it was built), to tell whether anything changed. */
async function contentHash(snapshot: PublicSnapshot): Promise<string> {
	return sha256Hex(JSON.stringify({ ...snapshot, generatedAt: 0 }));
}

export type PublishResult = { written: boolean; hash: string; bytes: number; snapshot: PublicSnapshot };

/** Builds the snapshot and writes it to KV only if its content changed. */
export async function publishSnapshot(db: D1Database, kv: KVNamespace, today: string, now: number = Date.now()): Promise<PublishResult> {
	const snapshot = await buildSnapshot(db, today, now);
	const hash = await contentHash(snapshot);
	const json = JSON.stringify(snapshot);
	const current = await kv.getWithMetadata<{ hash?: string }>(SNAPSHOT_KEY);
	if (current.metadata?.hash === hash && current.value !== null) return { written: false, hash, bytes: json.length, snapshot };
	await kv.put(SNAPSHOT_KEY, json, { metadata: { hash, generatedAt: now } });
	return { written: true, hash, bytes: json.length, snapshot };
}

/** The snapshot for the public pages; built and published once if it isn't there yet. */
export async function readSnapshot(kv: KVNamespace, db: D1Database, today: string): Promise<PublicSnapshot> {
	const cached = await kv.get<PublicSnapshot>(SNAPSHOT_KEY, { type: "json", cacheTtl: 60 });
	if (cached && cached.version === SNAPSHOT_VERSION) return cached;
	return (await publishSnapshot(db, kv, today)).snapshot;
}
