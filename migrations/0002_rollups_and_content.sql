-- Phase 2: daily roll-ups (kept forever; the only thing public pages read), product numbers,
-- journey entries and milestones. Roll-ups are written by the daily job (Phase 4).
-- '' in a roll-up key column means "none" (e.g. direct visits, no campaign, unknown country),
-- because primary key columns can't usefully be NULL.

CREATE TABLE daily_totals (
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	day TEXT NOT NULL CHECK (day IS date(day)),
	pageviews INTEGER NOT NULL DEFAULT 0 CHECK (pageviews >= 0),
	visitors INTEGER NOT NULL DEFAULT 0 CHECK (visitors >= 0 AND visitors <= pageviews),
	-- Visitors who came back later the same day (a new visit after 30+ minutes away).
	repeat_visitors INTEGER NOT NULL DEFAULT 0 CHECK (repeat_visitors >= 0 AND repeat_visitors <= visitors),
	events INTEGER NOT NULL DEFAULT 0 CHECK (events >= 0),
	-- Visitors by device, so device history survives the 90-day clean-up.
	desktop_visitors INTEGER NOT NULL DEFAULT 0 CHECK (desktop_visitors >= 0),
	mobile_visitors INTEGER NOT NULL DEFAULT 0 CHECK (mobile_visitors >= 0),
	tablet_visitors INTEGER NOT NULL DEFAULT 0 CHECK (tablet_visitors >= 0),
	other_visitors INTEGER NOT NULL DEFAULT 0 CHECK (other_visitors >= 0),
	-- Sums and counts so averages can be worked out later.
	engaged_ms_sum INTEGER NOT NULL DEFAULT 0 CHECK (engaged_ms_sum >= 0),
	engaged_count INTEGER NOT NULL DEFAULT 0 CHECK (engaged_count >= 0 AND engaged_count <= pageviews),
	scroll_pct_sum INTEGER NOT NULL DEFAULT 0 CHECK (scroll_pct_sum >= 0 AND scroll_pct_sum <= scroll_count * 100),
	scroll_count INTEGER NOT NULL DEFAULT 0 CHECK (scroll_count >= 0 AND scroll_count <= pageviews),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
	PRIMARY KEY (project_id, day)
) STRICT, WITHOUT ROWID;

CREATE TABLE daily_pages (
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	day TEXT NOT NULL CHECK (day IS date(day)),
	path TEXT NOT NULL CHECK (length(path) BETWEEN 1 AND 200 AND path GLOB '/*' AND path NOT GLOB '*[?#]*'),
	pageviews INTEGER NOT NULL CHECK (pageviews >= 0),
	visitors INTEGER NOT NULL CHECK (visitors >= 0 AND visitors <= pageviews),
	PRIMARY KEY (project_id, day, path)
) STRICT, WITHOUT ROWID;

CREATE TABLE daily_referrers (
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	day TEXT NOT NULL CHECK (day IS date(day)),
	-- '' = direct / none
	referrer_domain TEXT NOT NULL CHECK (length(referrer_domain) <= 253 AND referrer_domain NOT GLOB '*[^a-z0-9.-]*'),
	pageviews INTEGER NOT NULL CHECK (pageviews >= 0),
	visitors INTEGER NOT NULL CHECK (visitors >= 0 AND visitors <= pageviews),
	PRIMARY KEY (project_id, day, referrer_domain)
) STRICT, WITHOUT ROWID;

CREATE TABLE daily_refs (
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	day TEXT NOT NULL CHECK (day IS date(day)),
	ref TEXT NOT NULL CHECK (length(ref) BETWEEN 1 AND 40 AND ref NOT GLOB '*[^A-Za-z0-9-]*'),
	pageviews INTEGER NOT NULL CHECK (pageviews >= 0),
	visitors INTEGER NOT NULL CHECK (visitors >= 0 AND visitors <= pageviews),
	PRIMARY KEY (project_id, day, ref)
) STRICT, WITHOUT ROWID;

CREATE TABLE daily_campaigns (
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	day TEXT NOT NULL CHECK (day IS date(day)),
	-- '' = not set. At least one of the three is set.
	utm_source TEXT NOT NULL CHECK (length(utm_source) <= 50 AND utm_source NOT GLOB '*[^a-z0-9._-]*'),
	utm_medium TEXT NOT NULL CHECK (length(utm_medium) <= 50 AND utm_medium NOT GLOB '*[^a-z0-9._-]*'),
	utm_campaign TEXT NOT NULL CHECK (length(utm_campaign) <= 50 AND utm_campaign NOT GLOB '*[^a-z0-9._-]*'),
	pageviews INTEGER NOT NULL CHECK (pageviews >= 0),
	visitors INTEGER NOT NULL CHECK (visitors >= 0 AND visitors <= pageviews),
	CHECK (utm_source <> '' OR utm_medium <> '' OR utm_campaign <> ''),
	PRIMARY KEY (project_id, day, utm_source, utm_medium, utm_campaign)
) STRICT, WITHOUT ROWID;

CREATE TABLE daily_countries (
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	day TEXT NOT NULL CHECK (day IS date(day)),
	-- '' = unknown
	country TEXT NOT NULL CHECK (country = '' OR (length(country) = 2 AND country NOT GLOB '*[^A-Z]*')),
	pageviews INTEGER NOT NULL CHECK (pageviews >= 0),
	visitors INTEGER NOT NULL CHECK (visitors >= 0 AND visitors <= pageviews),
	PRIMARY KEY (project_id, day, country)
) STRICT, WITHOUT ROWID;

-- Event counts by name, so numbers like "case studies read" survive the 90-day clean-up.
CREATE TABLE daily_events (
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	day TEXT NOT NULL CHECK (day IS date(day)),
	name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 64 AND name GLOB '[a-z]*' AND name NOT GLOB '*[^a-z0-9_.-]*'),
	count INTEGER NOT NULL CHECK (count >= 0),
	-- Browser events only; server events have no visitor.
	visitors INTEGER NOT NULL DEFAULT 0 CHECK (visitors >= 0 AND visitors <= count),
	PRIMARY KEY (project_id, day, name)
) STRICT, WITHOUT ROWID;

-- Which numbers each project has, and which are public.
--   collector: built from page views ('visitors', 'pageviews', 'repeat_visitors')
--   event:     daily count of one event name
--   product:   sent by the product through /v1/metrics (e.g. 'returning_users')
CREATE TABLE metrics (
	id INTEGER PRIMARY KEY,
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	key TEXT NOT NULL CHECK (length(key) BETWEEN 1 AND 40 AND key GLOB '[a-z]*' AND key NOT GLOB '*[^a-z0-9_]*'),
	label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
	unit TEXT NOT NULL DEFAULT '' CHECK (length(unit) <= 20),
	source TEXT NOT NULL CHECK (source IN ('collector', 'event', 'product')),
	event_name TEXT CHECK (
		event_name IS NULL OR (length(event_name) BETWEEN 1 AND 64 AND event_name GLOB '[a-z]*' AND event_name NOT GLOB '*[^a-z0-9_.-]*')
	),
	is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
	-- The number in the pill on the project's card. Must be public; at most one per project.
	is_headline INTEGER NOT NULL DEFAULT 0 CHECK (is_headline IN (0, 1)),
	sort_order INTEGER NOT NULL DEFAULT 0,
	created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
	UNIQUE (project_id, key),
	CHECK (source <> 'collector' OR key IN ('visitors', 'pageviews', 'repeat_visitors')),
	CHECK ((source = 'event') = (event_name IS NOT NULL)),
	CHECK (is_headline = 0 OR is_public = 1)
) STRICT;

CREATE UNIQUE INDEX metrics_one_headline_per_project ON metrics (project_id) WHERE is_headline = 1;

-- Daily values for product metrics (the latest value sent that day wins).
CREATE TABLE metric_values (
	metric_id INTEGER NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
	day TEXT NOT NULL CHECK (day IS date(day)),
	value REAL NOT NULL CHECK (value BETWEEN -1e15 AND 1e15),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
	PRIMARY KEY (metric_id, day)
) STRICT, WITHOUT ROWID;

CREATE TABLE journey_entries (
	id INTEGER PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 80 AND slug NOT GLOB '*[^a-z0-9-]*'),
	title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
	-- Markdown. Sanitised before display.
	body_md TEXT NOT NULL DEFAULT '' CHECK (length(body_md) <= 50000),
	-- Optional: an entry can be about one project or the journey overall.
	project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
	is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
	published_at INTEGER,
	created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
	CHECK (is_published = 0 OR published_at IS NOT NULL)
) STRICT;

CREATE INDEX journey_entries_published ON journey_entries (is_published, published_at);
CREATE INDEX journey_entries_project ON journey_entries (project_id, published_at);

CREATE TABLE milestones (
	id INTEGER PRIMARY KEY,
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	day TEXT NOT NULL CHECK (day IS date(day)),
	title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
	note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 500),
	is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0, 1)),
	created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
) STRICT;

CREATE INDEX milestones_project_day ON milestones (project_id, day);
