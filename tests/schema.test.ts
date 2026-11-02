import { describe, expect, it } from "vitest";
import { createProject, db, expectRejected, insert, validPageView, VISITOR_ID } from "./helpers";

describe("seed", () => {
	it("has the portfolio and job board with their origins", async () => {
		const { results } = await db
			.prepare("SELECT slug, name, status, tagline, allowed_origins, public_key, secret_key_hash FROM projects ORDER BY sort_order")
			.all<Record<string, string | null>>();
		const seeded = results.filter((row) => row.slug === "portfolio" || row.slug === "job-board");
		expect(seeded).toEqual([
			{
				slug: "portfolio",
				name: "Portfolio",
				status: "live",
				tagline: "Product design case studies, from research to results.",
				allowed_origins: '["https://wahabalikhan.com","https://www.wahabalikhan.com"]',
				public_key: null,
				secret_key_hash: null,
			},
			{
				slug: "job-board",
				name: "Job Board",
				status: "building",
				tagline: "Only real tech jobs, straight from the company.",
				allowed_origins: '["https://jobboard.wahab-ali-khan.workers.dev"]',
				public_key: null,
				secret_key_hash: null,
			},
		]);
	});

	it("makes visitors the public headline number for both", async () => {
		const { results } = await db
			.prepare(
				"SELECT p.slug, m.key FROM metrics m JOIN projects p ON p.id = m.project_id WHERE m.is_headline = 1 AND m.is_public = 1 ORDER BY p.sort_order",
			)
			.all<{ slug: string; key: string }>();
		expect(results.filter((r) => ["portfolio", "job-board"].includes(r.slug))).toEqual([
			{ slug: "portfolio", key: "visitors" },
			{ slug: "job-board", key: "visitors" },
		]);
	});
});

describe("projects", () => {
	it("accepts a full, valid project", async () => {
		await expect(
			createProject({
				status: "building",
				tagline: "x".repeat(120),
				site_url: "https://example.com",
				health_url: "https://example.com/health",
				github_repo: "wahabalikhan/bobbybuilds",
				browser_events: '["contact_click"]',
				allowed_origins: '["https://example.com"]',
			}),
		).resolves.toBeGreaterThan(0);
	});

	it.each([
		["an unknown status", { status: "paused" }],
		["an upper-case slug", { slug: "Portfolio-2" }],
		["a slug with spaces", { slug: "my project" }],
		["a tagline over 120 characters", { tagline: "x".repeat(121) }],
		["a site URL that isn't https", { site_url: "http://example.com" }],
		["a health URL that isn't https", { health_url: "http://example.com/health" }],
		["a GitHub repo without an owner", { github_repo: "bobbybuilds" }],
		["a GitHub repo with extra parts", { github_repo: "a/b/c" }],
		["a GitHub repo with spaces", { github_repo: "wahab ali/repo" }],
		["allowed origins that aren't JSON", { allowed_origins: "https://example.com" }],
		["browser events as an object, not a list", { browser_events: '{"contact_click":true}' }],
		["a public key without pk_", { public_key: "xx_abcdefghijklmnopqrstuvwx" }],
		["a secret key hash of the wrong length", { secret_key_hash: "abc123", secret_key_hint: "abcd" }],
		["a secret key hash in upper case", { secret_key_hash: "A".repeat(64), secret_key_hint: "abcd" }],
		["a hash with no hint", { secret_key_hash: "a".repeat(64) }],
	])("rejects %s", async (_label, overrides) => {
		await expectRejected(createProject(overrides));
	});

	it("rejects a duplicate slug", async () => {
		await expectRejected(createProject({ slug: "portfolio" }), /UNIQUE constraint failed/);
	});

	it("deletes a project's page views with it", async () => {
		const projectId = await createProject();
		await insert("page_views", validPageView(projectId));
		await db.prepare("DELETE FROM projects WHERE id = ?1").bind(projectId).run();
		const row = await db.prepare("SELECT count(*) AS n FROM page_views WHERE project_id = ?1").bind(projectId).first<{ n: number }>();
		expect(row?.n).toBe(0);
	});
});

describe("page_views", () => {
	it("accepts a valid page view with every field", async () => {
		const projectId = await createProject();
		await expect(insert("page_views", validPageView(projectId))).resolves.toBeTruthy();
	});

	it("accepts a page view with only the required fields", async () => {
		const projectId = await createProject();
		await expect(
			insert("page_views", { project_id: projectId, ts: Date.now(), day: "2026-11-02", visitor_id: VISITOR_ID, path: "/" }),
		).resolves.toBeTruthy();
	});

	it.each([
		["an impossible date", { day: "2026-02-30" }],
		["a badly written date", { day: "2026/11/02" }],
		["a visitor ID that isn't a 64-character hash", { visitor_id: "abc" }],
		["a path without a leading slash", { path: "about" }],
		["a path with a query string", { path: "/jobs?id=1" }],
		["a path with a fragment", { path: "/jobs#top" }],
		["a path over 200 characters", { path: `/${"a".repeat(200)}` }],
		["a full referrer URL", { referrer_domain: "linkedin.com/feed" }],
		["an upper-case referrer domain", { referrer_domain: "LinkedIn.com" }],
		["a ref over 40 characters", { ref: "a".repeat(41) }],
		["a ref with an underscore", { ref: "linkedin_post" }],
		["a ref with a space", { ref: "linkedin post" }],
		["a utm_source in upper case", { utm_source: "LinkedIn" }],
		["a utm_medium with a space", { utm_medium: "paid social" }],
		["a utm_campaign over 50 characters", { utm_campaign: "a".repeat(51) }],
		["a lower-case country", { country: "gb" }],
		["a three-letter country", { country: "GBR" }],
		["Cloudflare's Tor code", { country: "T1" }],
		["an unknown device", { device: "watch" }],
		["a browser outside the broad groups", { browser: "brave" }],
		["an OS outside the broad groups", { os: "beos" }],
		["an exact screen size", { screen: "1920x1080" }],
		["a full language tag", { language: "en-GB" }],
		["an upper-case language", { language: "EN" }],
		["a one-letter language", { language: "e" }],
		["negative engaged time", { engaged_ms: -1 }],
		["engaged time over 30 minutes", { engaged_ms: 1_800_001 }],
		["scroll depth over 100%", { scroll_pct: 101 }],
		["negative scroll depth", { scroll_pct: -1 }],
		["an LCP over 60 seconds", { lcp_ms: 60_001 }],
		["a CLS over 10", { cls_milli: 10_001 }],
		["a negative INP", { inp_ms: -1 }],
	])("rejects %s", async (_label, overrides) => {
		const projectId = await createProject();
		await expectRejected(insert("page_views", validPageView(projectId, overrides)));
	});

	it("rejects a page view for a project that doesn't exist", async () => {
		await expectRejected(insert("page_views", validPageView(999_999)), /FOREIGN KEY constraint failed/);
	});

	it("accepts the edges of each limit", async () => {
		const projectId = await createProject();
		await expect(
			insert(
				"page_views",
				validPageView(projectId, {
					path: `/${"a".repeat(199)}`,
					ref: "A".repeat(40),
					utm_campaign: "a".repeat(50),
					language: "fil",
					engaged_ms: 1_800_000,
					scroll_pct: 100,
					lcp_ms: 60_000,
					cls_milli: 10_000,
					inp_ms: 0,
				}),
			),
		).resolves.toBeTruthy();
	});
});

describe("events", () => {
	const browserEvent = (projectId: number, overrides: Record<string, unknown> = {}) => ({
		project_id: projectId,
		ts: Date.now(),
		day: "2026-11-02",
		source: "browser",
		visitor_id: VISITOR_ID,
		name: "case_study_read",
		path: "/case-studies/hiring",
		props: '{"study":"hiring"}',
		...overrides,
	});

	it("accepts browser and server events", async () => {
		const projectId = await createProject();
		await expect(insert("events", browserEvent(projectId))).resolves.toBeTruthy();
		await expect(
			insert("events", browserEvent(projectId, { source: "server", visitor_id: null, name: "comment_posted" })),
		).resolves.toBeTruthy();
	});

	it.each([
		["a browser event without a visitor ID", { visitor_id: null }],
		["a server event with a visitor ID", { source: "server" }],
		["an unknown source", { source: "app" }],
		["a name with spaces", { name: "case study read" }],
		["a name in upper case", { name: "CaseStudyRead" }],
		["a name starting with a number", { name: "1st_visit" }],
		["a name over 64 characters", { name: "a".repeat(65) }],
		["props as a list", { props: '["a"]' }],
		["props that aren't JSON", { props: "{oops" }],
		["props over 1 KB", { props: JSON.stringify({ a: "x".repeat(1020) }) }],
	])("rejects %s", async (_label, overrides) => {
		const projectId = await createProject();
		await expectRejected(insert("events", browserEvent(projectId, overrides)));
	});
});

describe("daily_secret", () => {
	it("keeps one secret per day", async () => {
		await insert("daily_secret", { day: "2030-01-01", secret: "b".repeat(64) });
		await expectRejected(insert("daily_secret", { day: "2030-01-01", secret: "c".repeat(64) }), /UNIQUE constraint failed/);
	});

	it("rejects a secret that isn't 64 hex characters", async () => {
		await expectRejected(insert("daily_secret", { day: "2030-01-02", secret: "short" }));
		await expectRejected(insert("daily_secret", { day: "2030-01-02", secret: "Z".repeat(64) }));
	});
});

describe("uptime_checks", () => {
	it("accepts up and down checks", async () => {
		const projectId = await createProject();
		await expect(insert("uptime_checks", { project_id: projectId, checked_at: Date.now(), up: 1, response_ms: 120, status_code: 200 })).resolves.toBeTruthy();
		await expect(insert("uptime_checks", { project_id: projectId, checked_at: Date.now(), up: 0 })).resolves.toBeTruthy();
	});

	it.each([
		["up that isn't 0 or 1", { up: 2 }],
		["a response time over 60 seconds", { response_ms: 60_001 }],
		["a negative response time", { response_ms: -5 }],
		["an impossible status code", { status_code: 600 }],
	])("rejects %s", async (_label, overrides) => {
		const projectId = await createProject();
		await expectRejected(insert("uptime_checks", { project_id: projectId, checked_at: Date.now(), up: 1, ...overrides }));
	});
});

describe("github_weekly", () => {
	it("accepts a Monday and refuses a second row for the same week", async () => {
		const projectId = await createProject();
		await expect(insert("github_weekly", { project_id: projectId, week: "2026-11-02", commits: 14 })).resolves.toBeTruthy();
		await expectRejected(insert("github_weekly", { project_id: projectId, week: "2026-11-02", commits: 3 }), /UNIQUE constraint failed/);
	});

	it("rejects a week that doesn't start on a Monday", async () => {
		const projectId = await createProject();
		await expectRejected(insert("github_weekly", { project_id: projectId, week: "2026-11-03", commits: 1 }));
	});

	it("rejects a week that isn't a date at all", async () => {
		const projectId = await createProject();
		await expectRejected(insert("github_weekly", { project_id: projectId, week: "2026/11/02", commits: 1 }));
		await expectRejected(insert("github_weekly", { project_id: projectId, week: "last week", commits: 1 }));
	});

	it("rejects negative commits", async () => {
		const projectId = await createProject();
		await expectRejected(insert("github_weekly", { project_id: projectId, week: "2026-11-09", commits: -1 }));
	});
});

describe("github_contributions", () => {
	it("accepts a day and refuses a second row for the same day", async () => {
		await expect(insert("github_contributions", { day: "2026-10-12", count: 4, updated_at: 1 })).resolves.toBeTruthy();
		await expectRejected(insert("github_contributions", { day: "2026-10-12", count: 5, updated_at: 1 }), /UNIQUE constraint failed/);
	});

	it.each(["2026/10/12", "yesterday", "2026-02-30"])("rejects %s as a day", async (day) => {
		await expectRejected(insert("github_contributions", { day, count: 1, updated_at: 1 }));
	});

	it.each([-1, 100001])("rejects a count of %i", async (count) => {
		await expectRejected(insert("github_contributions", { day: "2026-10-13", count, updated_at: 1 }));
	});
});

describe("roll-ups", () => {
	it("refuses a second daily_totals row for the same project and day", async () => {
		const projectId = await createProject();
		await insert("daily_totals", { project_id: projectId, day: "2026-11-02", pageviews: 10, visitors: 4 });
		await expectRejected(
			insert("daily_totals", { project_id: projectId, day: "2026-11-02", pageviews: 1, visitors: 1 }),
			/UNIQUE constraint failed/,
		);
	});

	it.each([
		["a badly written day", { day: "2026/11/02", pageviews: 1, visitors: 1 }],
		["more visitors than page views", { pageviews: 3, visitors: 4 }],
		["more repeat visitors than visitors", { pageviews: 10, visitors: 4, repeat_visitors: 5 }],
		["negative page views", { pageviews: -1, visitors: 0 }],
		["a scroll total above 100% per sample", { pageviews: 10, visitors: 4, scroll_count: 2, scroll_pct_sum: 201 }],
		["more engaged samples than page views", { pageviews: 2, visitors: 1, engaged_count: 3 }],
	])("daily_totals rejects %s", async (_label, values) => {
		const projectId = await createProject();
		await expectRejected(insert("daily_totals", { project_id: projectId, day: "2026-11-02", ...values }));
	});

	it("keeps refs, campaigns and countries", async () => {
		const projectId = await createProject();
		const base = { project_id: projectId, day: "2026-11-02", pageviews: 5, visitors: 3 };
		await expect(insert("daily_refs", { ...base, ref: "linkedin-post-3" })).resolves.toBeTruthy();
		await expect(
			insert("daily_campaigns", { ...base, utm_source: "linkedin", utm_medium: "", utm_campaign: "launch_week" }),
		).resolves.toBeTruthy();
		await expect(insert("daily_countries", { ...base, country: "GB" })).resolves.toBeTruthy();
		await expect(insert("daily_countries", { ...base, country: "" })).resolves.toBeTruthy();
		await expect(insert("daily_referrers", { ...base, referrer_domain: "" })).resolves.toBeTruthy();
	});

	it.each([
		["daily_refs", "a ref with an underscore", { ref: "linkedin_post" }],
		["daily_refs", "a ref over 40 characters", { ref: "a".repeat(41) }],
		["daily_campaigns", "a campaign with nothing set", { utm_source: "", utm_medium: "", utm_campaign: "" }],
		["daily_campaigns", "an upper-case campaign", { utm_source: "LinkedIn", utm_medium: "", utm_campaign: "" }],
		["daily_countries", "a lower-case country", { country: "gb" }],
		["daily_referrers", "a referrer with a path", { referrer_domain: "linkedin.com/feed" }],
		["daily_pages", "a page path with a query string", { path: "/?q=1" }],
		["daily_events", "an event name with spaces", { name: "contact click", count: 1, visitors: 1, pageviews: undefined }],
	])("%s rejects %s", async (table, _label, values) => {
		const projectId = await createProject();
		const row: Record<string, unknown> = { project_id: projectId, day: "2026-11-02", pageviews: 5, visitors: 3, ...values };
		for (const key of Object.keys(row)) if (row[key] === undefined) delete row[key];
		await expectRejected(insert(table, row));
	});

	it("refuses duplicate page rows", async () => {
		const projectId = await createProject();
		const row = { project_id: projectId, day: "2026-11-02", path: "/", pageviews: 5, visitors: 3 };
		await insert("daily_pages", row);
		await expectRejected(insert("daily_pages", row), /UNIQUE constraint failed/);
	});
});

describe("metrics", () => {
	it("allows only one headline number per project", async () => {
		const projectId = await createProject();
		await insert("metrics", { project_id: projectId, key: "visitors", label: "Visitors", source: "collector", is_public: 1, is_headline: 1 });
		await expectRejected(
			insert("metrics", { project_id: projectId, key: "jobs_listed", label: "Jobs", source: "product", is_public: 1, is_headline: 1 }),
			/UNIQUE constraint failed/,
		);
	});

	it.each([
		["a private headline number", { key: "jobs", source: "product", is_public: 0, is_headline: 1 }],
		["a made-up collector number", { key: "bounce_rate", source: "collector" }],
		["an event number without an event name", { key: "reads", source: "event" }],
		["an event name on a product number", { key: "jobs", source: "product", event_name: "job_posted" }],
		["a key with a hyphen", { key: "jobs-listed", source: "product" }],
		["an unknown source", { key: "jobs", source: "manual" }],
	])("rejects %s", async (_label, values) => {
		const projectId = await createProject();
		await expectRejected(insert("metrics", { project_id: projectId, label: "Label", ...values }));
	});

	it("keeps one value per metric per day", async () => {
		const projectId = await createProject();
		const metric = await db
			.prepare("INSERT INTO metrics (project_id, key, label, source) VALUES (?1, 'jobs_listed', 'Jobs listed', 'product') RETURNING id")
			.bind(projectId)
			.first<{ id: number }>();
		await insert("metric_values", { metric_id: metric!.id, day: "2026-11-02", value: 42 });
		await expectRejected(insert("metric_values", { metric_id: metric!.id, day: "2026-11-02", value: 43 }), /UNIQUE constraint failed/);
	});
});

describe("journey_entries and milestones", () => {
	it("needs a publish date before an entry can be published", async () => {
		await expectRejected(insert("journey_entries", { slug: "first-week", title: "First week", is_published: 1 }));
		await expect(
			insert("journey_entries", { slug: "first-week", title: "First week", is_published: 1, published_at: Date.now() }),
		).resolves.toBeTruthy();
	});

	it("rejects a journey slug with capitals", async () => {
		await expectRejected(insert("journey_entries", { slug: "First-Week", title: "First week" }));
	});

	it("rejects a milestone title over 120 characters", async () => {
		const projectId = await createProject();
		await expectRejected(insert("milestones", { project_id: projectId, day: "2026-11-02", title: "x".repeat(121) }));
	});
});
