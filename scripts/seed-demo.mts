/**
 * Fills the LOCAL database with 120 days of realistic made-up data for the Portfolio and the
 * Job Board, then builds the real roll-ups and deletes raw data older than 90 days, so the
 * dashboard looks like it will after a few months. Never touches the live database.
 *
 *   npm run db:migrate:local && npm run seed:demo && npm run preview
 *
 * Re-running replaces the previous demo data. The same seed gives the same data.
 */
import { getPlatformProxy } from "wrangler";
import { addDays, utcDay, weekStart } from "../src/lib/days.ts";
import { rollupDay } from "../src/lib/jobs/rollup.ts";

if (process.argv.some((arg) => arg.includes("remote"))) {
	console.error("seed:demo only ever writes to the local database. It won't run with --remote.");
	process.exit(1);
}

const proxy = await getPlatformProxy<{ DB: D1Database; PUBLIC_CACHE: KVNamespace }>({ configPath: "wrangler.jsonc", remoteBindings: false, envFiles: [] });
const db = proxy.env.DB;

// Deterministic randomness, so every run makes the same data.
let seed = 20261102;
const random = () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (min: number, max: number) => min + random() * (max - min);
const chance = (p: number) => random() < p;
function pick<T>(weighted: [T, number][]): T {
	const total = weighted.reduce((t, [, w]) => t + w, 0);
	let r = random() * total;
	for (const [value, weight] of weighted) if ((r -= weight) <= 0) return value;
	return weighted[weighted.length - 1][0];
}
const hex = () => Array.from({ length: 64 }, () => Math.floor(random() * 16).toString(16)).join("");

const DAYS = 120;
const today = utcDay();
const firstDay = addDays(today, -(DAYS - 1));

type Row = Record<string, string | number | null>;
const queued: D1PreparedStatement[] = [];
async function flush(force = false) {
	while (queued.length >= 200 || (force && queued.length)) await db.batch(queued.splice(0, 200));
}
async function insert(table: string, row: Row) {
	const columns = Object.keys(row);
	queued.push(db.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map((_, i) => `?${i + 1}`).join(", ")})`).bind(...Object.values(row)));
	await flush();
}

const projects = (await db.prepare("SELECT id, slug FROM projects WHERE slug IN ('portfolio', 'job-board')").all<{ id: number; slug: string }>()).results;
const portfolio = projects.find((p) => p.slug === "portfolio");
const jobBoard = projects.find((p) => p.slug === "job-board");
if (!portfolio || !jobBoard) {
	console.error("Couldn't find the seeded projects. Run `npm run db:migrate:local` first.");
	await proxy.dispose();
	process.exit(1);
}
const ids = [portfolio.id, jobBoard.id];

console.log("Clearing previous demo data (local database)…");
for (const table of ["page_views", "events", "uptime_checks", "github_weekly", "daily_totals", "daily_pages", "daily_referrers", "daily_refs", "daily_campaigns", "daily_countries", "daily_events", "daily_uptime"]) {
	await db.prepare(`DELETE FROM ${table} WHERE project_id IN (?1, ?2)`).bind(...ids).run();
}
await db.prepare("DELETE FROM metric_values WHERE metric_id IN (SELECT id FROM metrics WHERE project_id IN (?1, ?2))").bind(...ids).run();
await db.prepare("DELETE FROM job_runs").run();

// Funnels (settings will edit these in part 5b).
await db
	.prepare("UPDATE projects SET funnel = ?2 WHERE id = ?1")
	.bind(portfolio.id, JSON.stringify([{ label: "Home", path: "/" }, { label: "Case study", path: "/case-studies/hiring-platform" }, { label: "Clicked contact", event: "contact_click" }]))
	.run();
await db
	.prepare("UPDATE projects SET funnel = ?2 WHERE id = ?1")
	.bind(jobBoard.id, JSON.stringify([{ label: "Jobs list", path: "/jobs" }, { label: "Viewed a job", path: "/jobs/view" }, { label: "Clicked apply", event: "outbound_click" }]))
	.run();

const COUNTRIES: [string | null, number][] = [["GB", 45], ["US", 14], ["IN", 7], ["DE", 5], ["NL", 4], ["CA", 4], ["PK", 4], ["IE", 3], ["FR", 3], ["AU", 2], ["ES", 2], [null, 2]];
const DEVICES: [{ device: string; browser: string; os: string; screen: string }, number][] = [
	[{ device: "desktop", browser: "chrome", os: "macos", screen: "large" }, 22],
	[{ device: "desktop", browser: "chrome", os: "windows", screen: "xlarge" }, 16],
	[{ device: "desktop", browser: "safari", os: "macos", screen: "xlarge" }, 10],
	[{ device: "desktop", browser: "firefox", os: "windows", screen: "large" }, 4],
	[{ device: "desktop", browser: "edge", os: "windows", screen: "large" }, 5],
	[{ device: "desktop", browser: "chrome", os: "linux", screen: "large" }, 2],
	[{ device: "mobile", browser: "safari", os: "ios", screen: "small" }, 22],
	[{ device: "mobile", browser: "chrome", os: "android", screen: "small" }, 10],
	[{ device: "mobile", browser: "samsung", os: "android", screen: "small" }, 3],
	[{ device: "tablet", browser: "safari", os: "ios", screen: "medium" }, 4],
];
const LANGUAGES: [string, number][] = [["en", 86], ["de", 3], ["nl", 2], ["fr", 2], ["es", 2], ["ur", 2], ["hi", 2]];

type Site = {
	id: number;
	launchDay: number; // days after firstDay
	base: number;
	growth: number;
	paths: [string, number][];
	referrers: [string | null, number][];
	refs: string[];
	campaigns: [string, string, string][];
	visitorEvents: (visitor: { day: string; id: string; ts: number; path: string }) => Promise<void>;
};

async function event(projectId: number, day: string, ts: number, name: string, path: string, props: object, visitor: string | null) {
	await insert("events", { project_id: projectId, ts, day, source: visitor ? "browser" : "server", visitor_id: visitor, name, path, props: JSON.stringify(props) });
}

const sites: Site[] = [
	{
		id: portfolio.id,
		launchDay: 0,
		base: 35,
		growth: 2.4,
		paths: [["/", 40], ["/case-studies/hiring-platform", 18], ["/case-studies/payments-dashboard", 12], ["/case-studies/onboarding", 8], ["/about", 10], ["/contact", 6], ["/journey", 6]],
		referrers: [[null, 42], ["linkedin.com", 28], ["google.com", 16], ["github.com", 5], ["bing.com", 2], ["duckduckgo.com", 2], ["read.cv", 2], ["news.ycombinator.com", 1]],
		refs: ["linkedin-post-1", "linkedin-post-2", "linkedin-post-3", "cv-pdf", "github-readme"],
		campaigns: [["linkedin", "social", "launch-week"], ["newsletter", "email", "november-update"], ["dribbble", "social", "shot-12"]],
		async visitorEvents(v) {
			if (v.path.startsWith("/case-studies") && chance(0.55)) await event(portfolio!.id, v.day, v.ts + 90_000, "case_study_read", v.path, { study: v.path.split("/")[2] }, v.id);
			if (v.path.startsWith("/case-studies") && chance(0.12)) await event(portfolio!.id, v.day, v.ts + 120_000, "comments_opened", v.path, {}, v.id);
			if (v.path.startsWith("/case-studies") && chance(0.03)) await event(portfolio!.id, v.day, v.ts + 240_000, "comment_posted", v.path, {}, v.id);
			if (chance(0.05)) await event(portfolio!.id, v.day, v.ts + 60_000, "contact_click", v.path, {}, v.id);
			if (chance(0.09)) await event(portfolio!.id, v.day, v.ts + 70_000, "outbound_click", v.path, { domain: pick([["linkedin.com", 5], ["github.com", 3], ["dribbble.com", 2]]) }, v.id);
			if (chance(0.04)) await event(portfolio!.id, v.day, v.ts + 50_000, "file_download", v.path, { file: "Wahab-Ali-Khan-CV.pdf", type: "pdf" }, v.id);
			if (chance(0.01)) await event(portfolio!.id, v.day, v.ts, "not_found", pick([["/old-case-study", 3], ["/blog", 2], ["/work/2023", 1]]), {}, v.id);
			if (v.path === "/contact" && chance(0.45)) {
				await event(portfolio!.id, v.day, v.ts + 20_000, "form_started", "/contact", { form: "contact" }, v.id);
				if (chance(0.55)) await event(portfolio!.id, v.day, v.ts + 95_000, "form_submitted", "/contact", { form: "contact" }, v.id);
			}
		},
	},
	{
		id: jobBoard.id,
		launchDay: 55,
		base: 8,
		growth: 7,
		paths: [["/", 20], ["/jobs", 34], ["/jobs/view", 30], ["/companies", 8], ["/alerts", 5], ["/about", 3]],
		referrers: [[null, 35], ["google.com", 25], ["linkedin.com", 22], ["reddit.com", 8], ["x.com", 4], ["indiehackers.com", 3], ["wahabalikhan.com", 3]],
		refs: ["reddit-launch", "linkedin-post-4", "portfolio-footer"],
		campaigns: [["reddit", "social", "launch"], ["linkedin", "social", "launch"]],
		async visitorEvents(v) {
			if (v.path === "/jobs/view" && chance(0.22)) {
				await event(jobBoard!.id, v.day, v.ts + 45_000, "outbound_click", v.path, { domain: pick([["monzo.com", 3], ["deliveroo.co.uk", 2], ["wise.com", 2], ["octopus.energy", 2], ["skyscanner.net", 1]]) }, v.id);
			}
			if (v.path === "/alerts" && chance(0.5)) {
				await event(jobBoard!.id, v.day, v.ts + 15_000, "form_started", "/alerts", { form: "job-alerts" }, v.id);
				if (chance(0.4)) await event(jobBoard!.id, v.day, v.ts + 60_000, "form_submitted", "/alerts", { form: "job-alerts" }, v.id);
			}
			if (chance(0.006)) await event(jobBoard!.id, v.day, v.ts, "not_found", "/jobs/expired-role", {}, v.id);
		},
	},
];

let pageViews = 0;
console.log(`Making ${DAYS} days of page views and events…`);
for (let d = 0; d < DAYS; d += 1) {
	const day = addDays(firstDay, d);
	const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
	for (const site of sites) {
		if (d < site.launchDay) continue;
		const age = (d - site.launchDay) / (DAYS - site.launchDay);
		const spike = site.id === portfolio.id && (d === 70 || d === 71) ? 3.2 : site.id === jobBoard.id && d === site.launchDay + 3 ? 4 : 1;
		const visitors = Math.round(site.base * (1 + site.growth * age) * (weekday === 0 || weekday === 6 ? 0.6 : 1) * between(0.75, 1.25) * spike);

		for (let v = 0; v < visitors; v += 1) {
			const id = hex();
			const look = pick(DEVICES);
			const country = pick(COUNTRIES);
			const language = pick(LANGUAGES);
			const referrer = pick(site.referrers);
			const ref = chance(0.14) ? site.refs[Math.floor(random() * site.refs.length)] : null;
			const campaign = !ref && chance(0.08) ? site.campaigns[Math.floor(random() * site.campaigns.length)] : null;
			const hour = Math.min(23, Math.max(0, Math.round(between(7, 22) + between(-2, 2))));
			let ts = Date.parse(`${day}T00:00:00Z`) + hour * 3_600_000 + Math.floor(random() * 3_600_000);
			const visits = chance(0.1) ? 2 : 1;
			const dayEnd = Math.min(Date.parse(`${day}T23:59:59Z`), Date.now());

			for (let visit = 0; visit < visits; visit += 1) {
				if (visit > 0) ts += Math.round(between(45, 300) * 60_000);
				if (ts >= dayEnd) break;
				const views = 1 + Math.floor(random() * random() * 4);
				for (let view = 0; view < views && ts < dayEnd; view += 1) {
					const path = view === 0 && visit === 0 ? pick(site.paths) : pick(site.paths);
					const first = view === 0 && visit === 0;
					const slow = look.device === "mobile" ? 1.35 : 1;
					await insert("page_views", {
						project_id: site.id,
						ts,
						day,
						visitor_id: id,
						path,
						referrer_domain: first ? referrer : null,
						ref: first ? ref : null,
						utm_source: first && campaign ? campaign[0] : null,
						utm_medium: first && campaign ? campaign[1] : null,
						utm_campaign: first && campaign ? campaign[2] : null,
						country,
						device: look.device,
						browser: look.browser,
						os: look.os,
						screen: look.screen,
						language,
						engaged_ms: chance(0.85) ? Math.round(between(4, 30) ** 1.6 * 1000) : null,
						scroll_pct: chance(0.85) ? Math.round(between(15, 100)) : null,
						lcp_ms: first && chance(0.8) ? Math.round(between(800, 2600) * slow * (chance(0.1) ? 1.8 : 1)) : null,
						cls_milli: first && chance(0.8) ? Math.round(between(0, 0.14) * 1000 * (chance(0.08) ? 3 : 1)) : null,
						inp_ms: first && chance(0.6) ? Math.round(between(40, 220) * slow * (chance(0.07) ? 3 : 1)) : null,
					});
					pageViews += 1;
					await site.visitorEvents({ day, id, ts, path });
					ts += Math.round(between(20, 400) * 1000);
				}
			}
		}
	}

	// Server events for the job board.
	if (d >= sites[1].launchDay) {
		const posted = Math.round(between(1, 6));
		for (let i = 0; i < posted; i += 1) {
			await event(jobBoard.id, day, Date.parse(`${day}T09:00:00Z`) + i * 1_800_000, "job_posted", "/", { plan: pick([["free", 3], ["featured", 1]]) }, null);
		}
	}
}
await flush(true);

console.log("Making uptime checks, commits and product numbers…");
const now = Date.now();
for (const [projectId, typical] of [[portfolio.id, 110], [jobBoard.id, 340]] as const) {
	const start = Date.parse(`${firstDay}T00:00:00Z`);
	const outageStart = now - 10 * 86_400_000;
	for (let t = start; t <= now; t += t > now - 3 * 86_400_000 ? 300_000 : 3_600_000) {
		const down = projectId === jobBoard.id && t >= outageStart && t < outageStart + 25 * 60_000;
		await insert("uptime_checks", {
			project_id: projectId,
			checked_at: t - (t % 300_000),
			up: down ? 0 : 1,
			response_ms: down ? null : Math.round(typical * between(0.7, 1.6)),
			status_code: down ? 503 : 200,
		});
	}
	// For the outage to show in the 30-day list, also add 5-minute checks around it.
	if (projectId === jobBoard.id) {
		for (let t = outageStart - 300_000; t <= outageStart + 30 * 60_000; t += 300_000) {
			const down = t >= outageStart && t < outageStart + 25 * 60_000;
			await insert("uptime_checks", { project_id: projectId, checked_at: t - (t % 300_000) + 1, up: down ? 0 : 1, response_ms: down ? null : 330, status_code: down ? 503 : 200 });
		}
	}
}

const thisWeek = weekStart(today);
for (const [projectId, typical] of [[portfolio.id, 6], [jobBoard.id, 14]] as const) {
	for (let w = 0; w < 26; w += 1) {
		const week = addDays(thisWeek, -7 * w);
		const commits = w === 9 && projectId === portfolio.id ? 0 : Math.round(typical * between(0.3, 1.6));
		await insert("github_weekly", { project_id: projectId, week, commits, updated_at: now });
	}
}

const returning = await db.prepare("SELECT id FROM metrics WHERE project_id = ?1 AND key = 'returning_users'").bind(jobBoard.id).first<{ id: number }>();
if (returning) {
	for (let d = sites[1].launchDay + 5; d < DAYS; d += 1) {
		await insert("metric_values", { metric_id: returning.id, day: addDays(firstDay, d), value: Math.round((d - sites[1].launchDay) * 0.9 * between(0.85, 1.15)), updated_at: now });
	}
}

for (let i = 0; i < 6; i += 1) {
	const startedAt = now - i * 300_000 - 60_000;
	await insert("job_runs", { task: "frequent", started_at: startedAt, finished_at: startedAt + 900, ok: 1, summary: '{"demo":true}' });
}
await insert("job_runs", { task: "daily", started_at: Date.parse(`${today}T00:10:00Z`), finished_at: Date.parse(`${today}T00:10:04Z`), ok: 1, summary: '{"demo":true}' });
await flush(true);

console.log("Adding demo descriptions, milestones and journey entries…");
await db
	.prepare("UPDATE projects SET description_md = ?2, links = ?3 WHERE id = ?1")
	.bind(
		portfolio.id,
		"Demo description. My portfolio shows **how I work**, not just what the screens look like: the research, the trade-offs and what happened after launch.\n\nEach case study covers:\n\n- the problem and who had it\n- what I tried, and what didn't work\n- the result, in numbers where I can share them\n\nRead them at [wahabalikhan.com](https://wahabalikhan.com).",
		JSON.stringify([{ label: "LinkedIn", url: "https://linkedin.com/in/wahabalikhan" }]),
	)
	.run();
await db
	.prepare("UPDATE projects SET description_md = ?2 WHERE id = ?1")
	.bind(jobBoard.id, "Demo description. A job board with **only real tech jobs**, taken straight from company careers pages. No recruiters, no reposts, no ghost jobs.")
	.run();
await db.prepare("DELETE FROM milestones WHERE project_id IN (?1, ?2)").bind(...ids).run();
for (const [projectId, day, title, note, isPublic] of [
	[jobBoard.id, addDays(today, -60), "Started building", "First commit on a weekend.", 1],
	[jobBoard.id, addDays(today, -40), "First 100 jobs listed", "", 1],
	[jobBoard.id, addDays(today, -12), "Private: talk to a sponsor", "This one is private and must never appear publicly.", 0],
	[portfolio.id, addDays(today, -100), "New portfolio live", "Rebuilt from scratch with case studies.", 1],
] as const) {
	await db.prepare("INSERT INTO milestones (project_id, day, title, note, is_public) VALUES (?1, ?2, ?3, ?4, ?5)").bind(projectId, day, title, note, isPublic).run();
}
await db.prepare("DELETE FROM journey_entries WHERE slug LIKE 'demo-%'").run();
// One entry of each type, plus a draft that must never appear publicly.
for (const [slug, type, title, body, link, projectId, published, daysAgo] of [
	["demo-shipped-alerts", "shipped", "Demo: job alerts are live", "Pick a role and a city, and get one email a week. No account needed.", "https://techjobs.bobbybuilds.app", jobBoard.id, 1, 3],
	["demo-decision-no-recruiters", "decision", "Demo: no recruiter listings", "Recruiter posts doubled the list but halved the trust. **Company careers pages only.**", null, jobBoard.id, 1, 9],
	["demo-lesson-ghost-jobs", "lesson", "Demo: ghost jobs hide in plain sight", "A job open for 90 days with no changes is usually not a real opening.", null, jobBoard.id, 1, 16],
	["demo-post-honest", "post", "Demo: what \"honest\" means for my tools", "No dark patterns, no fake urgency, no selling data. If a tool is free, it's free.", "https://linkedin.com/in/wahabalikhan", null, 1, 22],
	["demo-inspired-calm", "inspired", "Demo: calm software", "Tools that do one thing and get out of the way.", "https://example.com", null, 1, 30],
	["demo-report-october", "report", "Demo: October in numbers", "1,204 visitors, £12.40 in costs, £0 revenue. Next month: salaries.", null, null, 1, 5],
	["demo-draft-secret", "post", "Draft: not ready yet", "This draft must never appear publicly.", null, portfolio.id, 0, 0],
] as const) {
	const publishedAt = Date.parse(`${addDays(today, -daysAgo)}T09:00:00Z`);
	await db
		.prepare("INSERT INTO journey_entries (slug, type, title, body_md, link_url, project_id, is_published, published_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)")
		.bind(slug, type, title, body, link, projectId, published, publishedAt)
		.run();
}

console.log("Adding the demo profile, project cards, costs and revenue…");
await db
	.prepare("UPDATE profile SET this_week = ?1, building_since = ?2 WHERE id = 1")
	.bind("Demo: working on the CV fit for Tech Jobs · open to product design roles", addDays(today, -128))
	.run();
await db.prepare("UPDATE projects SET emoji = '🎨', case_study_url = 'https://wahabalikhan.com' WHERE id = ?1").bind(portfolio.id).run();
await db
	.prepare("UPDATE projects SET emoji = '💼', outcomes = ?2 WHERE id = ?1")
	.bind(jobBoard.id, // The demo job board only has returning_users as a product number.
		JSON.stringify(["{returning_users} people came back", "{visitors} visitors in 30 days"]))
	.run();
const thisMonth = today.slice(0, 7);
const lastMonth = addDays(`${thisMonth}-01`, -1).slice(0, 7);
await db.prepare("DELETE FROM money WHERE month IN (?1, ?2)").bind(thisMonth, lastMonth).run();
for (const month of [lastMonth, thisMonth]) {
	for (const [kind, service, projectId, pence] of [
		["cost", "Cloudflare", null, 500],
		["cost", "Supabase", jobBoard.id, 0],
		["cost", "Anthropic", jobBoard.id, month === thisMonth ? 640 : 410],
		["cost", "Domains", null, 100],
		["revenue", "Tech Jobs", jobBoard.id, 0],
	] as const) {
		await db.prepare("INSERT INTO money (month, kind, service, project_id, amount_pence) VALUES (?1, ?2, ?3, ?4, ?5)").bind(month, kind, service, projectId, pence).run();
	}
}
// A private number with a value that's easy to spot: it must never reach a public page.
await db.prepare("DELETE FROM metrics WHERE project_id = ?1 AND key = 'secret_revenue'").bind(jobBoard.id).run();
const secretMetric = await db
	.prepare("INSERT INTO metrics (project_id, key, label, source, is_public) VALUES (?1, 'secret_revenue', 'Private demo number', 'product', 0) RETURNING id")
	.bind(jobBoard.id)
	.first<{ id: number }>();
await db.prepare("INSERT INTO metric_values (metric_id, day, value) VALUES (?1, ?2, 987654)").bind(secretMetric!.id, today).run();
// Make returning users public so a product number shows on the public page.
await db.prepare("UPDATE metrics SET is_public = 1 WHERE project_id = ?1 AND key = 'returning_users'").bind(jobBoard.id).run();

console.log("Building roll-ups for every day…");
for (let d = 0; d < DAYS; d += 1) await rollupDay(db, addDays(firstDay, d), now);

// Same rule as the daily job: keep raw data for 90 days, roll-ups forever.
const before = addDays(today, -90);
await db.prepare("DELETE FROM page_views WHERE day < ?1").bind(before).run();
await db.prepare("DELETE FROM events WHERE day < ?1").bind(before).run();
await db.prepare("DELETE FROM uptime_checks WHERE checked_at < ?1").bind(Date.parse(`${before}T00:00:00Z`)).run();

// The public pages rebuild their snapshot from the new data on the next visit.
await proxy.env.PUBLIC_CACHE.delete("public-snapshot");

const counts = await db
	.prepare(
		`SELECT (SELECT count(*) FROM page_views WHERE project_id IN (?1, ?2)) AS views,
		        (SELECT count(*) FROM events WHERE project_id IN (?1, ?2)) AS events,
		        (SELECT count(*) FROM daily_totals WHERE project_id IN (?1, ?2)) AS days`,
	)
	.bind(...ids)
	.first<{ views: number; events: number; days: number }>();
await proxy.dispose();

console.log(`
✓ Demo data ready in the LOCAL database (${firstDay} to ${today}).
  ${pageViews} page views made; ${counts?.views} raw page views and ${counts?.events} events kept (last 90 days),
  ${counts?.days} days of roll-ups.

Next: make sure .dev.vars has LOCAL_ADMIN_PREVIEW=on, run \`npm run preview\` and open http://localhost:8787/admin
`);
