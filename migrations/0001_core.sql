-- Phase 2: core tables. Raw page_views and events are deleted after 90 days (Phase 4).
-- Conventions:
--   * Timestamps are INTEGER Unix milliseconds. Days are TEXT 'YYYY-MM-DD' in UTC; `day IS date(day)`
--     rejects anything that isn't a real calendar date (IS, not =, so a NULL from date() fails too).
--   * No personal data: no IPs, names or emails anywhere. Visitor IDs are daily-salted SHA-256 hashes.
--   * Product secret keys are stored only as SHA-256 hashes.

CREATE TABLE projects (
	id INTEGER PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE
		CHECK (length(slug) BETWEEN 1 AND 40 AND slug NOT GLOB '*[^a-z0-9-]*'),
	name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
	tagline TEXT NOT NULL DEFAULT '' CHECK (length(tagline) <= 120),
	description_md TEXT NOT NULL DEFAULT '' CHECK (length(description_md) <= 20000),
	status TEXT NOT NULL CHECK (status IN ('live', 'building', 'idea', 'retired')),
	-- One-line lesson, shown for retired projects.
	lesson TEXT CHECK (lesson IS NULL OR length(lesson) <= 160),
	logo_path TEXT CHECK (logo_path IS NULL OR (length(logo_path) <= 200 AND logo_path GLOB '/*')),
	site_url TEXT CHECK (site_url IS NULL OR (length(site_url) <= 300 AND site_url GLOB 'https://?*')),
	health_url TEXT CHECK (health_url IS NULL OR (length(health_url) <= 300 AND health_url GLOB 'https://?*')),
	-- "owner/repo"
	github_repo TEXT CHECK (
		github_repo IS NULL OR (
			length(github_repo) <= 140
			AND github_repo GLOB '?*/?*'
			AND github_repo NOT GLOB '*/*/*'
			AND github_repo NOT GLOB '*[^A-Za-z0-9._/-]*'
		)
	),
	-- JSON arrays. Element shapes are validated by the app.
	links TEXT NOT NULL DEFAULT '[]'          -- [{ "label": "...", "url": "https://..." }]
		CHECK (json_valid(links) AND json_type(links) = 'array' AND length(links) <= 4000),
	allowed_origins TEXT NOT NULL DEFAULT '[]' -- ["https://example.com"]
		CHECK (json_valid(allowed_origins) AND json_type(allowed_origins) = 'array' AND length(allowed_origins) <= 2000),
	browser_events TEXT NOT NULL DEFAULT '[]'  -- event names t.js may send, e.g. ["contact_click"]
		CHECK (json_valid(browser_events) AND json_type(browser_events) = 'array' AND length(browser_events) <= 4000),
	funnel TEXT NOT NULL DEFAULT '[]'          -- ordered steps, e.g. [{ "label": "...", "path": "/" }, { "label": "...", "event": "..." }]
		CHECK (json_valid(funnel) AND json_type(funnel) = 'array' AND length(funnel) <= 4000),
	-- Public key (used in t.js, safe to share) and the hash of the server-side secret key.
	public_key TEXT UNIQUE CHECK (
		public_key IS NULL OR (
			public_key GLOB 'pk_*' AND length(public_key) BETWEEN 20 AND 64
			AND substr(public_key, 4) NOT GLOB '*[^A-Za-z0-9]*'
		)
	),
	secret_key_hash TEXT UNIQUE CHECK (
		secret_key_hash IS NULL OR (length(secret_key_hash) = 64 AND secret_key_hash NOT GLOB '*[^0-9a-f]*')
	),
	-- Last few characters of the secret key, so settings can show which key is live.
	secret_key_hint TEXT CHECK (secret_key_hint IS NULL OR length(secret_key_hint) <= 8),
	keys_created_at INTEGER,
	sort_order INTEGER NOT NULL DEFAULT 0,
	created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
	CHECK ((secret_key_hash IS NULL) = (secret_key_hint IS NULL))
) STRICT;

CREATE TABLE page_views (
	id INTEGER PRIMARY KEY,
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	ts INTEGER NOT NULL CHECK (ts > 0),
	day TEXT NOT NULL CHECK (day IS date(day)),
	visitor_id TEXT NOT NULL CHECK (length(visitor_id) = 64 AND visitor_id NOT GLOB '*[^0-9a-f]*'),
	-- Path only: no query string or fragment.
	path TEXT NOT NULL CHECK (length(path) BETWEEN 1 AND 200 AND path GLOB '/*' AND path NOT GLOB '*[?#]*'),
	-- Domain only, never the full referrer URL.
	referrer_domain TEXT CHECK (
		referrer_domain IS NULL OR (length(referrer_domain) BETWEEN 1 AND 253 AND referrer_domain NOT GLOB '*[^a-z0-9.-]*')
	),
	ref TEXT CHECK (ref IS NULL OR (length(ref) BETWEEN 1 AND 40 AND ref NOT GLOB '*[^A-Za-z0-9-]*')),
	utm_source TEXT CHECK (utm_source IS NULL OR (length(utm_source) BETWEEN 1 AND 50 AND utm_source NOT GLOB '*[^a-z0-9._-]*')),
	utm_medium TEXT CHECK (utm_medium IS NULL OR (length(utm_medium) BETWEEN 1 AND 50 AND utm_medium NOT GLOB '*[^a-z0-9._-]*')),
	utm_campaign TEXT CHECK (utm_campaign IS NULL OR (length(utm_campaign) BETWEEN 1 AND 50 AND utm_campaign NOT GLOB '*[^a-z0-9._-]*')),
	-- ISO 3166-1 alpha-2 from Cloudflare; unknown or Tor is stored as NULL.
	country TEXT CHECK (country IS NULL OR (length(country) = 2 AND country NOT GLOB '*[^A-Z]*')),
	-- Broad groups only.
	device TEXT NOT NULL DEFAULT 'other' CHECK (device IN ('desktop', 'mobile', 'tablet', 'other')),
	browser TEXT NOT NULL DEFAULT 'other'
		CHECK (browser IN ('chrome', 'safari', 'firefox', 'edge', 'samsung', 'opera', 'other')),
	os TEXT NOT NULL DEFAULT 'other'
		CHECK (os IN ('windows', 'macos', 'ios', 'android', 'linux', 'chromeos', 'other')),
	-- Viewport width: small < 640px, medium < 1024px, large < 1440px, xlarge >= 1440px.
	screen TEXT NOT NULL DEFAULT 'unknown' CHECK (screen IN ('small', 'medium', 'large', 'xlarge', 'unknown')),
	-- Primary language subtag only, e.g. 'en'.
	language TEXT CHECK (language IS NULL OR (length(language) BETWEEN 2 AND 3 AND language NOT GLOB '*[^a-z]*')),
	-- Filled in by the leave beacon. Engaged time capped at 30 minutes.
	engaged_ms INTEGER CHECK (engaged_ms IS NULL OR engaged_ms BETWEEN 0 AND 1800000),
	scroll_pct INTEGER CHECK (scroll_pct IS NULL OR scroll_pct BETWEEN 0 AND 100)
) STRICT;

CREATE INDEX page_views_project_day_visitor ON page_views (project_id, day, visitor_id);
CREATE INDEX page_views_day ON page_views (day);

CREATE TABLE events (
	id INTEGER PRIMARY KEY,
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	ts INTEGER NOT NULL CHECK (ts > 0),
	day TEXT NOT NULL CHECK (day IS date(day)),
	source TEXT NOT NULL CHECK (source IN ('browser', 'server')),
	-- Browser events carry the daily visitor ID; server events never do.
	visitor_id TEXT CHECK (visitor_id IS NULL OR (length(visitor_id) = 64 AND visitor_id NOT GLOB '*[^0-9a-f]*')),
	name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 64 AND name GLOB '[a-z]*' AND name NOT GLOB '*[^a-z0-9_.-]*'),
	path TEXT CHECK (path IS NULL OR (length(path) BETWEEN 1 AND 200 AND path GLOB '/*' AND path NOT GLOB '*[?#]*')),
	-- Small flat object of short values. The collector also rejects anything that looks personal.
	props TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(props) AND json_type(props) = 'object' AND length(props) <= 1024),
	CHECK ((source = 'browser') = (visitor_id IS NOT NULL))
) STRICT;

CREATE INDEX events_project_day_name ON events (project_id, day, name);
CREATE INDEX events_day ON events (day);

-- Holds only today's secret. The daily job writes the new one and deletes the old one.
CREATE TABLE daily_secret (
	day TEXT PRIMARY KEY CHECK (day IS date(day)),
	secret TEXT NOT NULL CHECK (length(secret) = 64 AND secret NOT GLOB '*[^0-9a-f]*'),
	created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
) STRICT, WITHOUT ROWID;

CREATE TABLE uptime_checks (
	id INTEGER PRIMARY KEY,
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	checked_at INTEGER NOT NULL CHECK (checked_at > 0),
	up INTEGER NOT NULL CHECK (up IN (0, 1)),
	response_ms INTEGER CHECK (response_ms IS NULL OR response_ms BETWEEN 0 AND 60000),
	status_code INTEGER CHECK (status_code IS NULL OR status_code BETWEEN 100 AND 599)
) STRICT;

CREATE INDEX uptime_checks_project_checked ON uptime_checks (project_id, checked_at);
CREATE INDEX uptime_checks_checked ON uptime_checks (checked_at);

CREATE TABLE github_weekly (
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	-- The Monday (UTC) that starts the week.
	week TEXT NOT NULL CHECK (week IS date(week) AND strftime('%w', week) = '1'),
	commits INTEGER NOT NULL CHECK (commits >= 0),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
	PRIMARY KEY (project_id, week)
) STRICT, WITHOUT ROWID;
